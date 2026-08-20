-- ============================================================================
-- Fitur HUTANG PEMBELIAN (Fase 1) — audit 5.2.
-- Metode bayar "Hutang" di Pembelian: barang tetap masuk stok, tapi wallet baru
-- berkurang saat DIBAYAR (pay_purchases). Mirror pola "terhutang" di Penjualan.
-- ============================================================================

-- 1) Kolom status bayar di purchases -----------------------------------------
alter table public.purchases
  add column if not exists is_credit      boolean not null default false,
  add column if not exists due_date       date,
  add column if not exists paid_date      date,
  add column if not exists paid_wallet_id uuid references public.wallets(id);

-- Hutang belum bisa punya wallet pembayar → wallet_id boleh null.
alter table public.purchases alter column wallet_id drop not null;

-- Backfill: seluruh pembelian lama = bayar langsung (lunas saat beli).
update public.purchases
   set paid_date = coalesce(paid_date, purchase_date),
       paid_wallet_id = coalesce(paid_wallet_id, wallet_id)
 where paid_date is null;

-- 2) create_purchase: dukung metode hutang -----------------------------------
-- (DROP dulu karena tanda tangan bertambah 2 argumen; create_quick_deal yang
--  memanggil 6-argumen tetap jalan lewat DEFAULT.)
drop function if exists public.create_purchase(uuid, uuid, date, text, text, jsonb);

create function public.create_purchase(
  p_distributor_id uuid,
  p_wallet_id uuid,
  p_purchase_date date,
  p_invoice_no text,
  p_notes text,
  p_items jsonb,
  p_is_credit boolean default false,
  p_due_date date default null
) returns uuid
language plpgsql
security definer
as $function$
declare
  v_uid uuid := auth.uid();
  v_purchase_id uuid;
  v_total numeric(15,2) := 0;
  v_item jsonb;
  v_name text;
  v_qty int;
  v_price numeric;
  v_product_id uuid;
  v_sell numeric;
  v_warr int;
  v_unit text;
begin
  -- Bayar langsung wajib wallet; hutang tidak (wallet menyusul saat pelunasan).
  if not p_is_credit and p_wallet_id is null then
    raise exception 'Wallet pembayar wajib dipilih';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'Minimal 1 barang harus diisi';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_total := v_total + (v_item->>'qty')::int * (v_item->>'price')::numeric;
  end loop;

  insert into purchases(user_id, distributor_id, wallet_id, purchase_date, invoice_no,
                        total, notes, is_credit, due_date, paid_date, paid_wallet_id)
  values (v_uid, p_distributor_id,
          case when p_is_credit then null else p_wallet_id end,
          p_purchase_date, nullif(p_invoice_no,''), v_total, nullif(p_notes,''),
          p_is_credit,
          case when p_is_credit then p_due_date else null end,
          case when p_is_credit then null else p_purchase_date end,
          case when p_is_credit then null else p_wallet_id end)
  returning id into v_purchase_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_name  := trim(v_item->>'name');
    v_qty   := (v_item->>'qty')::int;
    v_price := (v_item->>'price')::numeric;
    v_sell  := coalesce(nullif(v_item->>'selling_price','')::numeric, 0);
    v_warr  := coalesce(nullif(v_item->>'warranty_months','')::int, 12);
    v_unit  := coalesce(nullif(v_item->>'unit',''), 'pcs');

    if v_name is null or v_name = '' then
      raise exception 'Nama barang tidak boleh kosong';
    end if;

    select id into v_product_id
      from products
      where user_id = v_uid and lower(name) = lower(v_name) and is_service = false
      limit 1;

    if v_product_id is null then
      insert into products(user_id, name, unit, last_purchase_price,
                           default_selling_price, default_warranty_months)
      values (v_uid, v_name, v_unit, v_price, v_sell, v_warr)
      returning id into v_product_id;
    else
      update products set
        last_purchase_price = v_price,
        default_selling_price = case when v_sell > 0 then v_sell else default_selling_price end,
        default_warranty_months = case when (v_item ? 'warranty_months')
             and nullif(v_item->>'warranty_months','') is not null
             then v_warr else default_warranty_months end
      where id = v_product_id and user_id = v_uid;
    end if;

    insert into purchase_items(user_id, purchase_id, product_id, qty, price)
    values (v_uid, v_purchase_id, v_product_id, v_qty, v_price);

    -- Stok tetap masuk (barang sudah di tangan), baik bayar langsung maupun hutang.
    insert into stock_movements(user_id, product_id, type, qty, ref_type, ref_id, note)
    values (v_uid, v_product_id, 'purchase_in', v_qty, 'purchase', v_purchase_id,
            'Pembelian: ' || v_name);
  end loop;

  -- Efek kas HANYA untuk bayar langsung. Hutang → menunggu pay_purchases.
  if not p_is_credit then
    insert into wallet_transactions(user_id, wallet_id, type, amount, tx_date, ref_type, ref_id, description)
    values (v_uid, p_wallet_id, 'expense', v_total, p_purchase_date, 'purchase', v_purchase_id, 'Pembelian barang');
  end if;

  return v_purchase_id;
end $function$;

revoke execute on function public.create_purchase(uuid,uuid,date,text,text,jsonb,boolean,date) from anon;
grant  execute on function public.create_purchase(uuid,uuid,date,text,text,jsonb,boolean,date) to authenticated;

-- 3) pay_purchases: lunasi beberapa nota hutang sekaligus (Opsi II) -----------
-- Satu baris pengeluaran wallet PER nota (tanggal & wallet sama). Melewati nota
-- yang bukan hutang / sudah lunas / bukan milik user → aman untuk multi-select.
create or replace function public.pay_purchases(
  p_ids uuid[], p_wallet_id uuid, p_paid_date date
) returns void
language plpgsql
security definer
as $function$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_total numeric(15,2);
  v_credit boolean;
  v_paid date;
begin
  if p_wallet_id is null then raise exception 'Pilih wallet pembayar'; end if;
  if p_ids is null or array_length(p_ids,1) is null then
    raise exception 'Tidak ada nota yang dipilih';
  end if;

  foreach v_id in array p_ids loop
    select total, is_credit, paid_date
      into v_total, v_credit, v_paid
      from purchases where id = v_id and user_id = v_uid;
    if v_total is null then continue; end if;      -- bukan milik user / tak ada
    if not v_credit or v_paid is not null then continue; end if;  -- bukan hutang / sudah lunas

    update purchases
       set paid_date = p_paid_date, paid_wallet_id = p_wallet_id
     where id = v_id and user_id = v_uid;

    insert into wallet_transactions(user_id, wallet_id, type, amount, tx_date, ref_type, ref_id, description)
    values (v_uid, p_wallet_id, 'expense', v_total, p_paid_date, 'purchase', v_id, 'Pembayaran hutang');
  end loop;
end $function$;

revoke execute on function public.pay_purchases(uuid[],uuid,date) from anon;
grant  execute on function public.pay_purchases(uuid[],uuid,date) to authenticated;

-- 4) dashboard_counts: tambah total_payable (hutang belum lunas) --------------
drop function if exists public.dashboard_counts();
create function public.dashboard_counts()
returns table(active_clients bigint, pending_invoices bigint,
              expiring_warranty bigint, total_receivable numeric, total_payable numeric)
language sql
security definer
as $function$
  select
    (select count(*) from clients where user_id=auth.uid() and status='active'),
    (select count(*) from monthly_invoices where user_id=auth.uid() and status <> 'paid'),
    (select count(*) from v_client_assets where warranty_status='expiring'),
    coalesce((select sum(total) from sales
       where user_id=auth.uid() and payment_method='monthly_invoice'
         and monthly_invoice_id in
           (select id from monthly_invoices where status <> 'paid')), 0)
    + coalesce((select sum(total) from sales
       where user_id=auth.uid() and payment_method='terhutang'
         and paid_date is null), 0),
    coalesce((select sum(total) from purchases
       where user_id=auth.uid() and is_credit=true and paid_date is null), 0)
$function$;

revoke execute on function public.dashboard_counts() from anon;
grant  execute on function public.dashboard_counts() to authenticated;

-- 5) finance_summary: pengeluaran pembelian (KAS) berbasis mutasi wallet ------
-- Total Pembelian (kartu) = aktivitas (semua nota); tapi LABA KAS memakai kas
-- nyata (wallet expense ref purchase) → hutang belum bayar tak mengurangi kas.
create or replace function public.finance_summary(p_from date, p_to date)
returns table(total_sales numeric, total_purchase numeric, total_op_expense numeric,
              total_personal_expense numeric, net_profit numeric, total_income numeric)
language sql
security definer
as $function$
  with sal as (
    select coalesce(sum(total),0) as v from sales
    where user_id = auth.uid() and sale_date between p_from and p_to
  ),
  rabpay as (
    select coalesce(sum(amount),0) as v from rab_payments
    where user_id = auth.uid() and payment_date between p_from and p_to
  ),
  pur_activity as (
    select coalesce(sum(total),0) as v from purchases
    where user_id = auth.uid() and purchase_date between p_from and p_to
  ),
  pur_cash as (
    select coalesce(sum(amount),0) as v from wallet_transactions
    where user_id = auth.uid() and type='expense' and ref_type='purchase'
      and tx_date between p_from and p_to
  ),
  rabexp as (
    select coalesce(sum(total),0) as v from rab_items
    where user_id = auth.uid() and item_type = 'expense'
      and paid_wallet_id is not null
      and paid_date between p_from and p_to
  ),
  op as (
    select coalesce(sum(amount),0) as v from operational_expenses
    where user_id = auth.uid() and expense_date between p_from and p_to
  ),
  pers as (
    select coalesce(sum(amount),0) as v from personal_expenses
    where user_id = auth.uid() and expense_date between p_from and p_to
  ),
  inc as (
    select coalesce(sum(amount),0) as v from wallet_transactions
    where user_id = auth.uid() and type='income'
      and ref_type in ('sale','invoice','rab','rab_payment')
      and tx_date between p_from and p_to
  )
  select
    sal.v,
    pur_activity.v,
    op.v,
    pers.v,
    (sal.v + rabpay.v) - (pur_cash.v + rabexp.v) - op.v - pers.v,
    inc.v
  from sal, rabpay, pur_activity, pur_cash, rabexp, op, pers, inc;
$function$;

-- 6) Pemeriksaan Data: E5 revisi (pembelian LUNAS saja) + E6 baru ------------
create or replace function public.data_integrity_report()
returns jsonb
language plpgsql
security definer
as $function$
declare
  u uuid := auth.uid();
  a1 int; a2 int; a3 int; a4 int; a5 int; a6 int; a7 int;
  b1 int; b2 int;
  c1 int; c2 int; c3 int; c4 int; c5 int;
  d1 int; d2 int;
  e1 int; e2 int; e3 int; e4 int; e5 int; e6 int;
begin
  select count(*) into a1 from sales
    where user_id=u and payment_method='monthly_invoice' and monthly_invoice_id is null;
  select count(*) into a2 from sales s
    where s.user_id=u and s.monthly_invoice_id is not null
      and not exists (select 1 from monthly_invoices mi where mi.id=s.monthly_invoice_id);
  select count(*) into a3 from sale_items si
    where si.user_id=u and not exists (select 1 from sales s where s.id=si.sale_id);
  select count(*) into a4 from client_assets ca
    where ca.user_id=u and ca.sale_item_id is not null
      and not exists (select 1 from sale_items si where si.id=ca.sale_item_id);
  select count(*) into a5 from stock_movements m
    where m.user_id=u and m.ref_type='sale'
      and not exists (select 1 from sales s where s.id=m.ref_id);
  select count(*) into a6 from monthly_invoices mi
    where mi.user_id=u and not exists (select 1 from sales s where s.monthly_invoice_id=mi.id);
  select count(*) into a7 from wallet_transactions w
    where w.user_id=u and w.ref_type='sale'
      and not exists (select 1 from sales s where s.id=w.ref_id);
  select count(*) into b1 from (
    select invoice_no from monthly_invoices where user_id=u
    group by invoice_no having count(*)>1) x;
  select count(*) into b2 from monthly_invoices
    where user_id=u and invoice_no !~ '^INV/\d{4}/\d{2}/\d+$';
  select count(*) into c1 from monthly_invoices mi
    where mi.user_id=u
      and mi.total <> coalesce((select sum(s.total) from sales s where s.monthly_invoice_id=mi.id),0);
  select count(*) into c2 from monthly_invoices
    where user_id=u and status='paid' and (paid_date is null or paid_wallet_id is null);
  select count(*) into c3 from sales
    where user_id=u and payment_method in ('cash','transfer') and wallet_id is null;
  select count(*) into c4 from v_wallet_balances b
    join wallets w on w.id=b.id where w.user_id=u and b.balance < 0;
  select count(*) into c5 from sales
    where user_id=u and payment_method='terhutang' and paid_date is not null and paid_wallet_id is null;
  select count(*) into d1 from v_product_stock where user_id=u and current_stock < 0;
  select count(*) into d2 from products p
    where p.user_id=u and p.is_service=true
      and exists (select 1 from stock_movements m where m.product_id=p.id);

  -- Grup E — Konsistensi Keuangan
  select count(*) into e1 from sale_items si
    join products p on p.id=si.product_id
    where si.user_id=u and coalesce(p.is_service,false)=false
      and coalesce(si.cost_price,0)=0 and si.qty>0;
  select count(*) into e2 from monthly_invoices mi
    where mi.user_id=u and mi.status='paid'
      and coalesce((select sum(w.amount) from wallet_transactions w
          where w.ref_type='invoice' and w.ref_id=mi.id and w.type='income'),0)
          <> (mi.total - coalesce(mi.pph_amount,0));
  select count(*) into e3 from sales s
    where s.user_id=u and s.payment_method='terhutang' and s.paid_date is not null
      and coalesce((select sum(w.amount) from wallet_transactions w
          where w.ref_type='sale' and w.ref_id=s.id and w.type='income'),0) <> s.total;
  select count(*) into e4 from sales s
    where s.user_id=u and s.payment_method in ('cash','transfer')
      and coalesce((select sum(w.amount) from wallet_transactions w
          where w.ref_type='sale' and w.ref_id=s.id and w.type='income'),0) <> s.total;
  -- E5 (revisi): hanya pembelian yang SUDAH LUNAS (paid_date terisi) yang
  -- pengeluaran wallet-nya harus = total. Hutang belum bayar dikecualikan.
  select count(*) into e5 from purchases pu
    where pu.user_id=u and pu.paid_date is not null
      and coalesce((select sum(w.amount) from wallet_transactions w
          where w.ref_type='purchase' and w.ref_id=pu.id and w.type='expense'),0) <> pu.total;
  -- E6 (baru): hutang BELUM lunas tapi sudah ada pengeluaran wallet (anomali).
  select count(*) into e6 from purchases pu
    where pu.user_id=u and pu.is_credit=true and pu.paid_date is null
      and exists (select 1 from wallet_transactions w
          where w.ref_type='purchase' and w.ref_id=pu.id and w.type='expense');

  return jsonb_build_array(
    jsonb_build_object('code','A1','label','Penjualan invoice-bulanan tanpa invoice','count',a1),
    jsonb_build_object('code','A2','label','Penjualan menunjuk invoice yang tidak ada','count',a2),
    jsonb_build_object('code','A3','label','Item penjualan tanpa induk penjualan','count',a3),
    jsonb_build_object('code','A4','label','Aset client tanpa item penjualan (orphan)','count',a4),
    jsonb_build_object('code','A5','label','Pergerakan stok menunjuk penjualan yang hilang','count',a5),
    jsonb_build_object('code','A6','label','Invoice tanpa penjualan tertaut','count',a6),
    jsonb_build_object('code','A7','label','Mutasi wallet menunjuk penjualan yang hilang','count',a7),
    jsonb_build_object('code','B1','label','Nomor invoice kembar','count',b1),
    jsonb_build_object('code','B2','label','Nomor invoice format tidak standar','count',b2),
    jsonb_build_object('code','C1','label','Total invoice tidak cocok jumlah penjualan','count',c1),
    jsonb_build_object('code','C2','label','Invoice lunas tanpa tanggal/wallet bayar','count',c2),
    jsonb_build_object('code','C3','label','Penjualan tunai/transfer tanpa wallet','count',c3),
    jsonb_build_object('code','C4','label','Saldo wallet negatif','count',c4),
    jsonb_build_object('code','C5','label','Penjualan terhutang lunas tanpa wallet','count',c5),
    jsonb_build_object('code','D1','label','Produk stok negatif','count',d1),
    jsonb_build_object('code','D2','label','Produk jasa memiliki pergerakan stok','count',d2),
    jsonb_build_object('code','E1','label','Barang terjual tanpa modal (HPP 0)','count',e1),
    jsonb_build_object('code','E2','label','Invoice lunas: netto wallet tidak cocok (total − PPh)','count',e2),
    jsonb_build_object('code','E3','label','Terhutang lunas: pemasukan wallet tidak cocok total','count',e3),
    jsonb_build_object('code','E4','label','Penjualan tunai/transfer: pemasukan wallet tidak cocok total','count',e4),
    jsonb_build_object('code','E5','label','Pembelian lunas: pengeluaran wallet tidak cocok total','count',e5),
    jsonb_build_object('code','E6','label','Hutang belum lunas tapi sudah ada pengeluaran wallet','count',e6)
  );
end $function$;

revoke execute on function public.data_integrity_report() from anon;
grant  execute on function public.data_integrity_report() to authenticated;
