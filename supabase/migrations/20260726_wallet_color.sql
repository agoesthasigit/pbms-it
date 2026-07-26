-- ============================================================
--  Warna kartu wallet — agar antar wallet mudah dibedakan.
--  Jalankan di Supabase → SQL Editor (satu langkah, aman).
-- ============================================================

-- Kolom warna (hex, mis. '#0ea5e9'). Boleh null → aplikasi pakai warna default per jenis.
alter table wallets add column if not exists color text;
