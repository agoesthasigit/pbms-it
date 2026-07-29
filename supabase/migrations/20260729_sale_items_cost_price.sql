-- ============================================================
--  Kunci HARGA MODAL (HPP) ke tiap baris penjualan (Opsi B).
--  Tujuan: laba "jual − beli" tidak berubah lagi walau harga beli produk
--  naik/turun setelah penjualan tercatat.
--
--  Contoh: printer dibeli 1jt lalu dijual 1,5jt di Mei → laba 500rb TERKUNCI.
--  Kalau Juni harga beli naik jadi 1,1jt, laba Mei TETAP 500rb (tidak ikut).
--
--  Jalankan di Supabase → SQL Editor (boleh sekali jalan).
-- ============================================================

-- 1) Kolom modal per item penjualan
alter table sale_items add column if not exists cost_price numeric(15,2) not null default 0;

-- 2) Backfill data lama: isi dengan harga beli terakhir produk yang ada SEKARANG
--    (perkiraan terbaik; data penjualan baru akan terkunci akurat).
update sale_items si
set cost_price = coalesce(p.last_purchase_price, 0)
from products p
where si.product_id = p.id
  and (si.cost_price is null or si.cost_price = 0);

-- 3) create_sale: kunci harga modal saat penjualan dibuat
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
  v_cost numeric(15,2);
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

  -- items + stok + asset
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_wmonths := coalesce((v_item->>'warranty_months')::int, 12);

    -- Kunci harga modal (HPP) SAAT penjualan: ambil harga beli terakhir produk
    -- sekarang, lalu simpan ke sale_items.cost_price. Setelah ini perubahan
    -- harga beli produk tidak lagi mengubah laba penjualan yang sudah tercatat.
    select name, coalesce(last_purchase_price, 0)
      into v_pname, v_cost
      from products where id=(v_item->>'product_id')::uuid;

    insert into sale_items(user_id, sale_id, product_id, qty, price, cost_price, warranty_months, serial_number)
    values (v_uid, v_sale_id, (v_item->>'product_id')::uuid,
            (v_item->>'qty')::int, (v_item->>'price')::numeric, v_cost,
            v_wmonths, nullif(v_item->>'serial_number',''))
    returning id into v_sale_item_id;

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
