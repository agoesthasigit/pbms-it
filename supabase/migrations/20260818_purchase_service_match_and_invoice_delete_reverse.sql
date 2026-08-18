-- 2026-08-18 — Revisi 1 (dua cacat):
--
-- Cacat A — Hapus invoice bulanan TIDAK mengembalikan stok.
--   delete_monthly_invoice lama hanya MELEPAS tautan penjualan
--   (monthly_invoice_id = null) sehingga penjualan (beserta stock_movements
--   keluarnya) tetap ada → stok tak pernah balik, dan penjualan jadi "yatim".
--   Diubah: hapus setiap penjualan yang tergabung + balikkan stok/aset/wallet
--   (meniru pola delete_sale), lalu hapus pelunasan & invoice.
--
-- Cacat B — Barang "hilang" dari Stok Barang karena bentrok nama dgn produk JASA.
--   Halaman Stok Barang membaca view v_product_stock (WHERE is_service=false),
--   jadi produk is_service=true TAK PERNAH tampil. create_purchase mencocokkan
--   produk by-nama case-insensitive TANPA memandang is_service, sehingga membeli
--   barang yang namanya sama dengan produk jasa (mis. nama layanan maintenance)
--   akan "nyangkut" ke produk jasa → stok bertambah di DB tapi tak tampil.
--   Diubah: pencocokan nama di create_purchase kini hanya ke produk BARANG
--   (is_service=false); nama yang bentrok dgn jasa akan membuat produk barang baru.

-- ============================================================================
-- Cacat B: create_purchase — cocokkan hanya ke produk barang (is_service=false)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_purchase(p_distributor_id uuid, p_wallet_id uuid, p_purchase_date date, p_invoice_no text, p_notes text, p_items jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
  if p_wallet_id is null then
    raise exception 'Wallet pembayar wajib dipilih';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'Minimal 1 barang harus diisi';
  end if;

  -- hitung total
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_total := v_total + (v_item->>'qty')::int * (v_item->>'price')::numeric;
  end loop;

  -- header pembelian
  insert into purchases(user_id, distributor_id, wallet_id, purchase_date, invoice_no, total, notes)
  values (v_uid, p_distributor_id, p_wallet_id, p_purchase_date,
          nullif(p_invoice_no,''), v_total, nullif(p_notes,''))
  returning id into v_purchase_id;

  -- proses tiap item
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

    -- cari produk BARANG (is_service=false) dengan nama sama (case-insensitive).
    -- Produk JASA sengaja diabaikan agar pembelian tak nyangkut ke katalog jasa.
    select id into v_product_id
      from products
      where user_id = v_uid and lower(name) = lower(v_name) and is_service = false
      limit 1;

    if v_product_id is null then
      -- produk baru → buat otomatis
      insert into products(user_id, name, unit, last_purchase_price,
                           default_selling_price, default_warranty_months)
      values (v_uid, v_name, v_unit, v_price, v_sell, v_warr)
      returning id into v_product_id;
    else
      -- produk sudah ada → update harga beli terakhir (dan harga jual/garansi bila diisi)
      update products set
        last_purchase_price = v_price,
        default_selling_price = case when v_sell > 0 then v_sell else default_selling_price end,
        default_warranty_months = case when (v_item ? 'warranty_months')
             and nullif(v_item->>'warranty_months','') is not null
             then v_warr else default_warranty_months end
      where id = v_product_id and user_id = v_uid;
    end if;

    -- catat item pembelian (simpan product_id hasil match/create)
    insert into purchase_items(user_id, purchase_id, product_id, qty, price)
    values (v_uid, v_purchase_id, v_product_id, v_qty, v_price);

    -- stok masuk
    insert into stock_movements(user_id, product_id, type, qty, ref_type, ref_id, note)
    values (v_uid, v_product_id, 'purchase_in', v_qty, 'purchase', v_purchase_id,
            'Pembelian: ' || v_name);
  end loop;

  -- wallet keluar
  insert into wallet_transactions(user_id, wallet_id, type, amount, tx_date, ref_type, ref_id, description)
  values (v_uid, p_wallet_id, 'expense', v_total, p_purchase_date, 'purchase', v_purchase_id, 'Pembelian barang');

  return v_purchase_id;
end $function$;

-- ============================================================================
-- Cacat A: delete_monthly_invoice — hapus penjualan tergabung + balikkan stok
-- ============================================================================
CREATE OR REPLACE FUNCTION public.delete_monthly_invoice(p_invoice_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_uid uuid := auth.uid();
  v_sale_id uuid;
begin
  -- Balikkan tiap penjualan yang tergabung (stok masuk lagi, aset & wallet tx
  -- terhapus), lalu hapus penjualannya. Meniru pola delete_sale.
  for v_sale_id in
    select id from sales where monthly_invoice_id = p_invoice_id and user_id = v_uid
  loop
    delete from stock_movements
      where ref_type = 'sale' and ref_id = v_sale_id and user_id = v_uid;
    delete from wallet_transactions
      where ref_type = 'sale' and ref_id = v_sale_id and user_id = v_uid;
    delete from client_assets
      where sale_item_id in (select id from sale_items where sale_id = v_sale_id)
        and user_id = v_uid;
    delete from sales where id = v_sale_id and user_id = v_uid;  -- sale_items cascade
  end loop;

  -- Hapus pelunasan invoice (bila sudah lunas) + invoice-nya sendiri.
  delete from wallet_transactions
    where ref_type = 'invoice' and ref_id = p_invoice_id and user_id = v_uid;
  delete from monthly_invoices where id = p_invoice_id and user_id = v_uid;
end $function$;
