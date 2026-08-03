-- ============================================================
-- Barang HABIS PAKAI (non-aset) — flag per produk.
--
-- Konteks: aturan lama "setiap barang terjual otomatis jadi aset client"
-- ternyata salah untuk barang habis pakai (kertas QR, stempel, amplop,
-- brosur). Barang itu tetap dibeli dari vendor (punya modal), dijual
-- (punya untung), dan stoknya tetap tercatat DIAM-DIAM demi HPP yang
-- akurat — SATU-SATUNYA bedanya dengan printer dsb: TIDAK dibuatkan
-- aset client (dan otomatis tanpa garansi).
--
-- Solusi: kolom products.track_as_asset (default TRUE = perilaku lama).
-- create_sale hanya membuat client_assets bila produknya track_as_asset.
-- Additive & mundur-kompatibel: semua produk existing tetap = aset.
-- ============================================================

alter table public.products
  add column if not exists track_as_asset boolean not null default true;

comment on column public.products.track_as_asset is
  'TRUE = barang tahan lama, dibuatkan aset client saat terjual (default). '
  'FALSE = barang habis pakai (kertas/stempel): tetap punya modal/stok/untung, '
  'tapi tidak jadi aset client dan tanpa garansi.';

-- ------------------------------------------------------------
-- create_sale: sama seperti sebelumnya, hanya menambah pengecekan
-- track_as_asset sebelum membuat client_assets (tanda tangan sama).
-- ------------------------------------------------------------
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
  v_track_asset boolean;
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
    -- sekarang, lalu simpan ke sale_items.cost_price. Sekalian ambil flag
    -- track_as_asset untuk menentukan apakah dibuatkan aset client.
    select name, coalesce(last_purchase_price, 0), track_as_asset
      into v_pname, v_cost, v_track_asset
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

    -- Barang habis pakai (track_as_asset=false): stok/modal tetap tercatat di
    -- atas, tapi TIDAK dibuatkan aset client (dan otomatis tanpa garansi).
    if coalesce(v_track_asset, true) then
      insert into client_assets(user_id, client_id, sale_item_id, product_name, serial_number, purchase_date, warranty_end, notes)
      values (v_uid, p_client_id, v_sale_item_id, v_pname,
              nullif(v_item->>'serial_number',''), p_sale_date,
              (p_sale_date + (v_wmonths || ' months')::interval)::date, null);
    end if;
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

-- ------------------------------------------------------------
-- v_product_stock dipakai halaman produk (select *). Kolom baru WAJIB
-- di AKHIR SELECT agar CREATE OR REPLACE VIEW diterima (urutan kolom
-- lama tidak boleh berubah).
-- ------------------------------------------------------------
create or replace view public.v_product_stock as
  select p.id,
         p.user_id,
         p.name,
         p.sku,
         p.category_id,
         p.unit,
         p.last_purchase_price,
         p.default_selling_price,
         p.min_stock,
         p.default_warranty_months,
         p.is_active,
         p.created_at,
         p.is_service,
         coalesce(sum(m.qty), 0::bigint)::integer as current_stock,
         p.track_as_asset
    from products p
    left join stock_movements m on m.product_id = p.id
   where p.is_service = false
   group by p.id;
