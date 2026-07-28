-- ============================================================
--  NOTA untuk penjualan (tunai / transfer / terhutang yang sudah lunas).
--  Menyimpan nomor NOTA permanen agar tidak pernah berubah (Opsi B).
--  Format nomor: NOTA/YYYY/MM/NNN (mis. NOTA/2026/07/001).
--
--  Nomor DIISI SAAT PDF pertama kali dibuat (lazy) oleh route
--  /api/sales/[id]/pdf, bukan lewat trigger — jadi hanya penjualan yang
--  benar-benar dicetak yang memakai nomor (tidak ada nomor terbuang).
--
--  Jalankan di Supabase → SQL Editor.
-- ============================================================

alter table sales add column if not exists nota_no text;

-- Nomor NOTA harus unik (abaikan baris yang belum punya nomor).
create unique index if not exists sales_nota_no_key
  on sales(nota_no) where nota_no is not null;
