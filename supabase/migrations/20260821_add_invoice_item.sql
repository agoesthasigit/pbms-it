-- 2026-08-21 — Tahap 2: tambah baris LANGSUNG ke invoice bulanan (belum lunas).
--
-- Melengkapi Tahap 1 (edit/hapus baris). Dulu untuk menambah barang/jasa ke
-- invoice yang sudah jadi harus lewat menu Penjualan → create_sale, yang hanya
-- MENGGABUNG ke invoice DRAFT client+periode (invoice 'sent' malah dibuatkan
-- invoice kedua). Fungsi ini menautkan penjualan baru LANGSUNG ke invoice_id
-- tertentu, jadi bekerja untuk invoice draft MAUPUN sent (asal belum lunas).
--
-- Logika per-item meniru create_sale (20260803): barang → validasi stok, kunci
-- HPP (last_purchase_price), stock_movements sale_out, client_assets (bila
-- track_as_asset); jasa → produk generik 'Jasa' + item_name, tanpa stok/aset.
-- Tanggal penjualan = hari terakhir periode invoice (tetap di dalam periode).

create or replace function public.add_invoice_item(
  p_invoice_id uuid,
  p_is_service boolean,
  p_product_id uuid,
  p_item_name text,
  p_qty int,
  p_price numeric,
  p_warranty_months int default 12,
  p_serial text default null
)
returns void
language plpgsql
security definer
as $function$
declare
  v_uid uuid := auth.uid();
  v_client uuid;
  v_period date;
  v_status invoice_status;
  v_sale_date date;
  v_sale_id uuid;
  v_stock int;
  v_pname text;
  v_cost numeric(15,2);
  v_track boolean;
  v_service_pid uuid;
  v_sname text;
  v_sale_item_id uuid;
  v_warr int;
begin
  select client_id, period_month, status
    into v_client, v_period, v_status
    from monthly_invoices where id = p_invoice_id and user_id = v_uid;

  if v_client is null then
    raise exception 'Invoice tidak ditemukan';
  end if;
  if v_status = 'paid' then
    raise exception 'Invoice sudah lunas. Batalkan lunas dulu sebelum menambah baris.';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'Qty harus lebih dari 0';
  end if;
  if p_price is null or p_price < 0 then
    raise exception 'Harga tidak valid';
  end if;

  -- tanggal penjualan = hari terakhir periode invoice
  v_sale_date := (date_trunc('month', v_period) + interval '1 month - 1 day')::date;

  -- header nota (1 baris) tertaut LANGSUNG ke invoice ini
  insert into sales(user_id, client_id, wallet_id, sale_date, payment_method,
                    total, notes, monthly_invoice_id)
  values (v_uid, v_client, null, v_sale_date, 'monthly_invoice',
          p_qty * p_price, null, p_invoice_id)
  returning id into v_sale_id;

  if coalesce(p_is_service, false) then
    -- JASA: produk generik 'Jasa' + deskripsi asli di item_name (tanpa stok/aset)
    v_sname := trim(p_item_name);
    if v_sname is null or v_sname = '' then
      raise exception 'Nama jasa tidak boleh kosong';
    end if;
    v_service_pid := find_or_create_service_product('Jasa');
    insert into sale_items(user_id, sale_id, product_id, qty, price, cost_price,
                           warranty_months, serial_number, item_name)
    values (v_uid, v_sale_id, v_service_pid, p_qty, p_price, 0, 0, null, v_sname);
  else
    -- BARANG: validasi stok, kunci HPP, stok keluar, aset client
    if p_product_id is null then
      raise exception 'Barang wajib dipilih';
    end if;
    select current_stock, name into v_stock, v_pname
      from v_product_stock where id = p_product_id;
    if v_stock is null then
      raise exception 'Barang tidak ditemukan';
    end if;
    if p_qty > v_stock then
      raise exception 'Stok "%" tidak cukup (tersedia %, diminta %)',
        v_pname, v_stock, p_qty;
    end if;

    v_warr := coalesce(p_warranty_months, 12);
    select coalesce(last_purchase_price, 0), track_as_asset
      into v_cost, v_track
      from products where id = p_product_id;

    insert into sale_items(user_id, sale_id, product_id, qty, price, cost_price,
                           warranty_months, serial_number, item_name)
    values (v_uid, v_sale_id, p_product_id, p_qty, p_price, v_cost,
            v_warr, nullif(p_serial, ''), null)
    returning id into v_sale_item_id;

    insert into stock_movements(user_id, product_id, type, qty, ref_type, ref_id, note)
    values (v_uid, p_product_id, 'sale_out', -1 * p_qty, 'sale', v_sale_id,
            'Penjualan barang');

    if coalesce(v_track, true) then
      insert into client_assets(user_id, client_id, sale_item_id, product_name,
                                serial_number, purchase_date, warranty_end, notes)
      values (v_uid, v_client, v_sale_item_id, v_pname, nullif(p_serial, ''),
              v_sale_date,
              (v_sale_date + (v_warr || ' months')::interval)::date, null);
    end if;
  end if;

  -- hitung ulang total invoice dari semua nota tertaut
  update monthly_invoices set total = coalesce((
    select sum(total) from sales where monthly_invoice_id = p_invoice_id and user_id = v_uid
  ), 0)
  where id = p_invoice_id and user_id = v_uid;
end $function$;
