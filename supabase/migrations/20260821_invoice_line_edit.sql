-- 2026-08-21 — Edit/Hapus baris invoice bulanan (belum lunas) + Batal Lunas.
--
-- Konteks: menu Invoice Bulanan → Lihat Invoice. Dulu satu-satunya cara koreksi
-- barang/harga salah adalah HAPUS seluruh invoice lalu buat ulang. Kini bisa
-- edit/hapus PER BARIS — TAPI hanya pada invoice BELUM LUNAS agar laporan
-- keuangan tak rusak. Invoice LUNAS wajib "Batal Lunas" dulu (membalik penuh
-- pemasukan wallet + PPh) baru boleh diubah.
--
-- Aturan yang dipegang (penting bila menambah fitur terkait):
--  * Baris invoice bermetode monthly_invoice → TIDAK ada transaksi wallet sampai
--    invoice dilunasi. Jadi edit harga / hapus baris pada invoice belum lunas
--    NOL dampak ke kas — hanya menata ulang sales.total & monthly_invoices.total
--    (dan stok untuk hapus baris barang).
--  * Baris MAINTENANCE (sales.maintenance_contract_id tidak null) DIKECUALIKAN
--    dari edit/hapus per baris — tetap lewat kontrak / hapus seluruh invoice.
--    (Penanda "sudah ditagih" maintenance = ADANYA baris sales periode itu;
--    hapus seluruh invoice menghapus baris → periode otomatis bisa ditagih ulang.)
--  * Nama baris BARANG mengikuti katalog produk → tak diedit di sini (salah
--    produk = hapus baris + jual ulang). Hanya baris JASA (item_name teks bebas)
--    yang namanya boleh diedit.

-- ============================================================================
-- 1) delete_invoice_item — hapus SATU baris, balikkan stok, hitung ulang total
-- ============================================================================
create or replace function public.delete_invoice_item(p_sale_item_id uuid)
returns void
language plpgsql
security definer
as $function$
declare
  v_uid uuid := auth.uid();
  v_sale_id uuid;
  v_invoice_id uuid;
  v_product_id uuid;
  v_qty int;
  v_maint uuid;
  v_status invoice_status;
  v_is_service boolean;
  v_total_lines int;
  v_remaining int;
begin
  -- resolve baris → nota → invoice (semua milik user)
  select si.sale_id, si.product_id, si.qty, s.maintenance_contract_id, s.monthly_invoice_id
    into v_sale_id, v_product_id, v_qty, v_maint, v_invoice_id
    from sale_items si
    join sales s on s.id = si.sale_id
    where si.id = p_sale_item_id and si.user_id = v_uid;

  if v_sale_id is null then
    raise exception 'Baris tidak ditemukan';
  end if;
  if v_invoice_id is null then
    raise exception 'Baris ini tidak tergabung dalam invoice bulanan';
  end if;

  select status into v_status
    from monthly_invoices where id = v_invoice_id and user_id = v_uid;
  if v_status = 'paid' then
    raise exception 'Invoice sudah lunas. Batalkan lunas dulu sebelum mengubah isi.';
  end if;

  if v_maint is not null then
    raise exception 'Baris maintenance tidak bisa dihapus per baris. Hapus lewat kontrak atau seluruh invoice.';
  end if;

  -- jangan sampai invoice jadi kosong
  select count(*) into v_total_lines
    from sale_items si
    join sales s on s.id = si.sale_id
    where s.monthly_invoice_id = v_invoice_id and si.user_id = v_uid;
  if v_total_lines <= 1 then
    raise exception 'Ini baris terakhir invoice. Gunakan Hapus Invoice.';
  end if;

  select coalesce(is_service, false) into v_is_service
    from products where id = v_product_id;

  -- balik stok: hapus SATU gerakan sale_out yang cocok (hanya untuk barang;
  -- baris jasa tak punya stock_movements). ref_id = sale_id (bukan per item),
  -- jadi target lewat product_id + qty, batasi 1 baris via ctid.
  if not coalesce(v_is_service, false) then
    delete from stock_movements
      where ctid in (
        select ctid from stock_movements
        where user_id = v_uid and ref_type = 'sale' and ref_id = v_sale_id
          and product_id = v_product_id and type = 'sale_out' and qty = -1 * v_qty
        limit 1
      );
  end if;

  -- hapus aset client yang lahir dari baris ini (bila ada)
  delete from client_assets
    where sale_item_id = p_sale_item_id and user_id = v_uid;

  -- hapus barisnya
  delete from sale_items where id = p_sale_item_id and user_id = v_uid;

  -- nota kosong ikut terhapus; selain itu hitung ulang total nota
  select count(*) into v_remaining
    from sale_items where sale_id = v_sale_id and user_id = v_uid;
  if v_remaining = 0 then
    delete from sales where id = v_sale_id and user_id = v_uid;
  else
    update sales set total = coalesce((
      select sum(subtotal) from sale_items where sale_id = v_sale_id and user_id = v_uid
    ), 0)
    where id = v_sale_id and user_id = v_uid;
  end if;

  -- hitung ulang total invoice dari SEMUA nota tertaut
  update monthly_invoices set total = coalesce((
    select sum(total) from sales where monthly_invoice_id = v_invoice_id and user_id = v_uid
  ), 0)
  where id = v_invoice_id and user_id = v_uid;
end $function$;

-- ============================================================================
-- 2) update_invoice_item — edit harga (semua baris) + nama (baris JASA saja)
--    Tak menyentuh stok/kas (qty tetap; subtotal kolom generated).
-- ============================================================================
create or replace function public.update_invoice_item(
  p_sale_item_id uuid,
  p_item_name text,
  p_price numeric
)
returns void
language plpgsql
security definer
as $function$
declare
  v_uid uuid := auth.uid();
  v_sale_id uuid;
  v_invoice_id uuid;
  v_product_id uuid;
  v_maint uuid;
  v_status invoice_status;
  v_is_service boolean;
begin
  select si.sale_id, si.product_id, s.maintenance_contract_id, s.monthly_invoice_id
    into v_sale_id, v_product_id, v_maint, v_invoice_id
    from sale_items si
    join sales s on s.id = si.sale_id
    where si.id = p_sale_item_id and si.user_id = v_uid;

  if v_sale_id is null then
    raise exception 'Baris tidak ditemukan';
  end if;
  if v_invoice_id is null then
    raise exception 'Baris ini tidak tergabung dalam invoice bulanan';
  end if;

  select status into v_status
    from monthly_invoices where id = v_invoice_id and user_id = v_uid;
  if v_status = 'paid' then
    raise exception 'Invoice sudah lunas. Batalkan lunas dulu sebelum mengubah isi.';
  end if;
  if v_maint is not null then
    raise exception 'Baris maintenance tidak bisa diubah per baris.';
  end if;
  if p_price is null or p_price < 0 then
    raise exception 'Harga tidak valid';
  end if;

  select coalesce(is_service, false) into v_is_service
    from products where id = v_product_id;

  -- harga selalu boleh; nama hanya baris jasa (barang pakai nama katalog).
  -- Nama kosong diabaikan (pertahankan yang lama).
  if coalesce(v_is_service, false) then
    update sale_items
      set price = p_price,
          item_name = coalesce(nullif(trim(p_item_name), ''), item_name)
      where id = p_sale_item_id and user_id = v_uid;
  else
    update sale_items
      set price = p_price
      where id = p_sale_item_id and user_id = v_uid;
  end if;

  update sales set total = coalesce((
    select sum(subtotal) from sale_items where sale_id = v_sale_id and user_id = v_uid
  ), 0)
  where id = v_sale_id and user_id = v_uid;

  update monthly_invoices set total = coalesce((
    select sum(total) from sales where monthly_invoice_id = v_invoice_id and user_id = v_uid
  ), 0)
  where id = v_invoice_id and user_id = v_uid;
end $function$;

-- ============================================================================
-- 3) unpay_invoice — Batal Lunas: balik penuh pemasukan wallet + PPh, status
--    kembali ke sent (bila pernah dikirim email) / draft.
-- ============================================================================
create or replace function public.unpay_invoice(p_invoice_id uuid)
returns void
language plpgsql
security definer
as $function$
declare
  v_uid uuid := auth.uid();
  v_status invoice_status;
  v_emailed timestamptz;
begin
  select status, email_sent_at into v_status, v_emailed
    from monthly_invoices where id = p_invoice_id and user_id = v_uid;

  if v_status is null then
    raise exception 'Invoice tidak ditemukan';
  end if;
  if v_status <> 'paid' then
    raise exception 'Invoice belum lunas';
  end if;

  -- balik pemasukan wallet dari pelunasan (netto yang dicatat mark_invoice_paid)
  delete from wallet_transactions
    where ref_type = 'invoice' and ref_id = p_invoice_id and user_id = v_uid;

  -- reset ke belum lunas
  update monthly_invoices
    set status = case when v_emailed is not null
                      then 'sent'::invoice_status
                      else 'draft'::invoice_status end,
        paid_date = null,
        paid_wallet_id = null,
        pph_base = 0,
        pph_rate = 2.5,
        pph_amount = 0
    where id = p_invoice_id and user_id = v_uid;
end $function$;
