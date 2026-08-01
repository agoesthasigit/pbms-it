-- Penjualan JASA (tanpa modal/stok) dalam satu nota bersama barang.
--
-- Konteks: form Penjualan sebelumnya hanya bisa menjual PRODUK (butuh stok &
-- modal). Kasus nyata "install ulang laptop Rp100.000, tanpa modal" tidak bisa
-- dicatat karena validasi stok memblokir (stok 0) dan produk jasa belum ada
-- alurnya di form manual. Migrasi ini menambah dukungan baris JASA:
--   * kolom sale_items.item_name → nama jasa bebas per transaksi (barang: null)
--   * create_sale menerima item ber-flag is_service → lewati stok, movement,
--     dan client_asset; modal 0; produk diarahkan ke satu produk generik "Jasa"
--     (is_service=true) supaya katalog barang tidak terkotori.
-- Additive & mundur-kompatibel: item lama (barang) tetap berperilaku sama,
-- item_name null.

-- 1) Nama jasa bebas (null untuk baris barang biasa)
alter table public.sale_items
  add column if not exists item_name text;

-- 2) create_sale: dukung item barang ATAU jasa dalam satu p_items jsonb
--    Bentuk item barang : { product_id, qty, price, warranty_months, serial_number }
--    Bentuk item jasa   : { is_service: true, name, qty, price }
create or replace function public.create_sale(
  p_client_id uuid, p_wallet_id uuid, p_sale_date date,
  p_payment_method public.payment_method, p_notes text, p_items jsonb,
  p_period_month date default null::date, p_due_date date default null::date
) returns uuid
    language plpgsql security definer
    as $$
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
  v_is_service boolean;
  v_product_id uuid;
  v_sname text;
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

  -- validasi stok (khusus barang; jasa tidak punya stok) + hitung total
  for v_item in select * from jsonb_array_elements(p_items) loop
    if coalesce((v_item->>'is_service')::boolean, false) then
      v_total := v_total + (v_item->>'qty')::int * (v_item->>'price')::numeric;
      continue;
    end if;
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

  -- items: barang (stok + asset) atau jasa (tanpa stok/asset)
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_is_service := coalesce((v_item->>'is_service')::boolean, false);

    if v_is_service then
      v_sname := trim(v_item->>'name');
      if v_sname is null or v_sname = '' then
        raise exception 'Nama jasa tidak boleh kosong';
      end if;
      -- satu produk generik "Jasa" (is_service) supaya katalog barang bersih;
      -- deskripsi asli disimpan di sale_items.item_name → tampil di NOTA.
      v_product_id := find_or_create_service_product('Jasa');

      insert into sale_items(user_id, sale_id, product_id, qty, price, cost_price,
                             warranty_months, serial_number, item_name)
      values (v_uid, v_sale_id, v_product_id,
              (v_item->>'qty')::int, (v_item->>'price')::numeric, 0,
              0, null, v_sname);
      -- jasa: tidak ada stock_movements & tidak ada client_assets (tanpa garansi)
      continue;
    end if;

    v_wmonths := coalesce((v_item->>'warranty_months')::int, 12);

    -- Kunci harga modal (HPP) SAAT penjualan: ambil harga beli terakhir produk
    -- sekarang, lalu simpan ke sale_items.cost_price.
    select name, coalesce(last_purchase_price, 0)
      into v_pname, v_cost
      from products where id=(v_item->>'product_id')::uuid;

    insert into sale_items(user_id, sale_id, product_id, qty, price, cost_price,
                           warranty_months, serial_number, item_name)
    values (v_uid, v_sale_id, (v_item->>'product_id')::uuid,
            (v_item->>'qty')::int, (v_item->>'price')::numeric, v_cost,
            v_wmonths, nullif(v_item->>'serial_number',''), null)
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
end $$;
