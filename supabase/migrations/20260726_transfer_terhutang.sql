-- ============================================================
--  Tambah metode bayar penjualan:
--    - transfer  : lunas via wallet (seperti tunai, beda label)
--    - terhutang : piutang yang TIDAK masuk invoice bulanan; dilunasi manual
--  Jalankan di Supabase → SQL Editor.
--
--  PENTING soal urutan:
--    Postgres tidak mengizinkan MEMAKAI nilai enum baru di transaksi yang
--    sama saat nilai itu ditambahkan. Jadi:
--      1) Blok STEP 1 dijalankan LEBIH DULU (Run), tunggu sukses.
--      2) Baru jalankan blok STEP 2.
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- STEP 1 — tambah nilai enum (JALANKAN SENDIRI, LALU baru STEP 2)
-- ─────────────────────────────────────────────────────────────
alter type payment_method add value if not exists 'transfer';
alter type payment_method add value if not exists 'terhutang';


-- ─────────────────────────────────────────────────────────────
-- STEP 2 — kolom baru + fungsi (jalankan setelah STEP 1 sukses)
-- ─────────────────────────────────────────────────────────────

-- Kolom untuk piutang terhutang: jatuh tempo + jejak pelunasan
alter table sales add column if not exists due_date       date;
alter table sales add column if not exists paid_date      date;
alter table sales add column if not exists paid_wallet_id uuid references wallets(id);


-- create_sale: kini paham transfer & terhutang
create or replace function public.create_sale(
  p_client_id uuid, p_wallet_id uuid, p_sale_date date,
  p_payment_method payment_method, p_notes text, p_items jsonb,
  p_period_month date default null::date, p_due_date date default null::date)
 returns uuid
 language plpgsql
 security definer
as $function$
declare
  v_uid uuid := auth.uid();
  v_sale_id uuid;
  v_total numeric(15,2) := 0;
  v_item jsonb;
  v_stock int;
  v_pname text;
  v_sale_item_id uuid;
  v_wmonths int;
  v_invoice_id uuid := null;
begin
  -- tunai & transfer sama-sama butuh wallet penerima
  if p_payment_method in ('cash','transfer') and p_wallet_id is null then
    raise exception 'Penjualan tunai/transfer wajib memilih wallet';
  end if;
  if p_payment_method = 'monthly_invoice' and p_period_month is null then
    raise exception 'Penjualan invoice wajib memilih periode';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'Minimal 1 barang harus diisi';
  end if;

  -- validasi stok
  for v_item in select * from jsonb_array_elements(p_items) loop
    select current_stock, name into v_stock, v_pname
      from v_product_stock where id=(v_item->>'product_id')::uuid;
    if v_stock is null then raise exception 'Barang tidak ditemukan'; end if;
    if (v_item->>'qty')::int > v_stock then
      raise exception 'Stok "%" tidak cukup (tersedia %, diminta %)',
        v_pname, v_stock, (v_item->>'qty')::int;
    end if;
    v_total := v_total + (v_item->>'qty')::int * (v_item->>'price')::numeric;
  end loop;

  -- hanya invoice bulanan yang membuat/menyatu ke invoice
  if p_payment_method = 'monthly_invoice' then
    v_invoice_id := find_or_create_invoice(p_client_id, p_period_month, p_due_date);
  end if;

  -- header penjualan
  insert into sales(
    user_id, client_id, wallet_id, sale_date, payment_method, total, notes,
    monthly_invoice_id, due_date, paid_date, paid_wallet_id)
  values (
    v_uid, p_client_id,
    case when p_payment_method in ('cash','transfer') then p_wallet_id else null end,
    p_sale_date, p_payment_method, v_total, nullif(p_notes,''),
    v_invoice_id,
    case when p_payment_method = 'terhutang' then p_due_date else null end,
    case when p_payment_method in ('cash','transfer') then p_sale_date else null end,
    case when p_payment_method in ('cash','transfer') then p_wallet_id else null end)
  returning id into v_sale_id;

  -- items + stok + asset (tidak berubah)
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_wmonths := coalesce((v_item->>'warranty_months')::int, 12);

    insert into sale_items(user_id, sale_id, product_id, qty, price, warranty_months, serial_number)
    values (v_uid, v_sale_id, (v_item->>'product_id')::uuid,
            (v_item->>'qty')::int, (v_item->>'price')::numeric,
            v_wmonths, nullif(v_item->>'serial_number',''))
    returning id into v_sale_item_id;

    select name into v_pname from products where id=(v_item->>'product_id')::uuid;

    insert into stock_movements(user_id, product_id, type, qty, ref_type, ref_id, note)
    values (v_uid, (v_item->>'product_id')::uuid, 'sale_out',
            -1 * (v_item->>'qty')::int, 'sale', v_sale_id, 'Penjualan barang');

    insert into client_assets(user_id, client_id, sale_item_id, product_name, serial_number, purchase_date, warranty_end, notes)
    values (v_uid, p_client_id, v_sale_item_id, v_pname,
            nullif(v_item->>'serial_number',''), p_sale_date,
            (p_sale_date + (v_wmonths || ' months')::interval)::date, null);
  end loop;

  -- efek keuangan
  if p_payment_method in ('cash','transfer') then
    insert into wallet_transactions(user_id, wallet_id, type, amount, tx_date, ref_type, ref_id, description)
    values (v_uid, p_wallet_id, 'income', v_total, p_sale_date, 'sale', v_sale_id,
            case when p_payment_method='transfer' then 'Penjualan transfer' else 'Penjualan tunai' end);
  elsif p_payment_method = 'monthly_invoice' then
    update monthly_invoices set total = total + v_total
      where id = v_invoice_id and user_id = v_uid;
  end if;
  -- terhutang: belum ada efek kas; menunggu pelunasan (pay_sale)

  return v_sale_id;
end $function$;


-- pay_sale: pelunasan penjualan terhutang → kredit wallet + tandai lunas
create or replace function public.pay_sale(
  p_sale_id uuid, p_wallet_id uuid, p_paid_date date)
 returns void
 language plpgsql
 security definer
as $function$
declare
  v_uid uuid := auth.uid();
  v_method payment_method;
  v_total numeric(15,2);
  v_paid date;
begin
  select payment_method, total, paid_date
    into v_method, v_total, v_paid
    from sales where id = p_sale_id and user_id = v_uid;

  if v_method is null then raise exception 'Penjualan tidak ditemukan'; end if;
  if v_method <> 'terhutang' then
    raise exception 'Hanya penjualan terhutang yang dilunasi di sini';
  end if;
  if v_paid is not null then raise exception 'Penjualan ini sudah lunas'; end if;
  if p_wallet_id is null then raise exception 'Pilih wallet penerima'; end if;

  update sales
    set paid_date = p_paid_date, paid_wallet_id = p_wallet_id, wallet_id = p_wallet_id
    where id = p_sale_id and user_id = v_uid;

  insert into wallet_transactions(user_id, wallet_id, type, amount, tx_date, ref_type, ref_id, description)
  values (v_uid, p_wallet_id, 'income', v_total, p_paid_date, 'sale', p_sale_id,
          'Pelunasan piutang (terhutang)');
end $function$;

-- Catatan: delete_sale TIDAK perlu diubah — ia sudah menghapus wallet_transactions
-- berdasarkan ref_type='sale', sehingga pembatalan transfer & pelunasan terhutang
-- otomatis mengoreksi saldo wallet.
