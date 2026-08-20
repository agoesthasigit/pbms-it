-- ============================================================================
-- Audit Tahap 5 — perbaikan 5.3 & 5.4 (2026-08-20)
-- ============================================================================

-- 5.3 — Hapus overload lama mark_invoice_paid(uuid, uuid, date).
-- Versi 3-arg mencatat BRUTO ke wallet TANPA PPh; berbahaya bila terpanggil
-- (saldo wallet tak cocok mutasi bank + PPh hilang dari laporan). Aplikasi selalu
-- memakai versi 5-arg (netto + PPh). Setelah 3-arg dihapus, panggilan bergaya
-- 3-arg tetap jalan lewat DEFAULT arg ke-4 & ke-5 (pph_base=0 → PPh 0 → netto =
-- total), jadi hasilnya identik dengan perilaku lama — hanya jalur bruto-tanpa-PPh
-- yang hilang. Tanda tangan 5-arg TIDAK disentuh.
drop function if exists public.mark_invoice_paid(uuid, uuid, date);

-- 5.4 — delete_purchase: tolak bila pembalikan membuat stok < 0.
-- delete_purchase membalik stok masuk (purchase_in) pembelian. Bila stok produk
-- saat ini sudah lebih kecil dari qty yang ditambahkan pembelian ini, artinya
-- sebagian/seluruh barangnya SUDAH TERJUAL → menghapus pembelian akan membuat
-- stok negatif dan meninggalkan HPP menggantung. Kini ditolak dengan pesan jelas;
-- user harus menghapus penjualannya lebih dulu. Perilaku lain (hapus stok/wallet
-- tx pembelian, cascade purchase_items) tidak berubah.
create or replace function public.delete_purchase(p_id uuid)
returns void
language plpgsql
security definer
as $function$
declare
  v_uid uuid := auth.uid();
  v_bad record;
begin
  if not exists (select 1 from purchases where id = p_id and user_id = v_uid) then
    raise exception 'Pembelian tidak ditemukan';
  end if;

  -- Guard: bandingkan stok produk saat ini dengan qty yang ditambah pembelian ini.
  -- current_stock < qty_in  ⇒  barang sudah terjual  ⇒  tolak.
  select p.name as name, vps.current_stock as current_stock, sum(pi.qty) as qty_in
    into v_bad
    from purchase_items pi
    join products p on p.id = pi.product_id
    join v_product_stock vps on vps.id = pi.product_id
    where pi.purchase_id = p_id and pi.user_id = v_uid
    group by p.name, vps.current_stock
    having vps.current_stock < sum(pi.qty)
    limit 1;

  if found then
    raise exception
      'Tidak bisa hapus: stok "%" tinggal %, tapi pembelian ini menambah % (barang sudah terjual). Hapus penjualannya dulu.',
      v_bad.name, v_bad.current_stock, v_bad.qty_in;
  end if;

  delete from stock_movements    where ref_type = 'purchase' and ref_id = p_id and user_id = v_uid;
  delete from wallet_transactions where ref_type = 'purchase' and ref_id = p_id and user_id = v_uid;
  delete from purchases where id = p_id and user_id = v_uid; -- purchase_items cascade
end $function$;
