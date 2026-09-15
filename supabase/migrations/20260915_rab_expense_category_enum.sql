-- RAB: kategori pengeluaran (Fase 1) — bagian A: tambah nilai enum.
--
-- CATATAN PENTING: PostgreSQL melarang MEMAKAI nilai enum baru pada transaksi
-- yang sama dengan ALTER TYPE ... ADD VALUE. Karena itu penambahan nilai enum
-- dipisah ke file migrasi tersendiri (harus di-COMMIT lebih dulu) sebelum file
-- 20260915_rab_item_category.sql memakainya untuk seed kategori.
alter type category_type add value if not exists 'rab_expense';
