# Audit Sistem PBMS-IT

Dokumen hidup (living document) untuk mengaudit aplikasi PBMS-IT menyeluruh
sebelum dan selama sistem berjalan **full-online** (Vercel + GitHub + Supabase).
Diisi **bertahap**; tiap tahap punya checkpoint agar bisa dilanjutkan kapan saja.

- **Auditor:** Claude (audit mandiri, atas permintaan pemilik)
- **Mulai:** 2026-08-18
- **Target sistem:** sepenuhnya online, dipakai operasional harian
- **Tujuan:** temukan _apa yang kurang_ dan _apa yang harus diperbaiki_

---

## Cara membaca & melanjutkan dokumen ini

1. Lihat **Papan Progres** di bawah — tahap mana `SELESAI`, `BERJALAN`, `BELUM`.
2. Tiap tahap punya bagian sendiri: **Cakupan → Temuan → Rekomendasi**.
3. Tingkat keparahan temuan: 🔴 Kritis · 🟠 Perlu diperbaiki · 🟡 Sebaiknya · 🟢 Baik.
4. Untuk melanjutkan: ambil tahap `BELUM` berikutnya, kerjakan, isi bagiannya,
   perbarui Papan Progres.

---

## Papan Progres (checkpoint)

| # | Tahap | Status | Ringkasan hasil |
|---|-------|--------|-----------------|
| 1 | Integritas Data | ✅ SELESAI (2026-08-18) | Bersih — tak ada anomali; 1 rekomendasi preventif |
| 2 | Keamanan (RLS, secret, auth) | ✅ SELESAI (2026-08-18) | 🔴 2.1 & 🟠 2.2 **SUDAH DIPERBAIKI & diverifikasi**; 🟡 2.3/2.4 catatan; sisi kode bersih |
| 3 | Alur Bisnis & Efisiensi Input | ⬜ BELUM | — |
| 4 | UX/UI & Desain | ⬜ BELUM | — |

> Catatan metode: audit dikerjakan langsung (bukan multi-agent), keluaran berupa
> laporan dokumen ini. Scan DB memakai koneksi **baca-saja** ke Supabase produksi
> lewat `pg` (npm) + `SUPABASE_DB_URL` (psql portabel sedang korup).

---

## Tahap 1 — Integritas Data ✅

**Cakupan.** Scan baca-saja seluruh tabel transaksional untuk mendeteksi anomali
yang berbahaya bagi laporan keuangan & stok. 16 kelas anomali diperiksa.

**Hasil scan (2026-08-18) — snapshot volume:** 17 penjualan · 11 pembelian ·
8 invoice · 23 produk aktif · 8 client · 1 wallet.

| Kode | Pemeriksaan | Hasil |
|------|-------------|-------|
| A1 | Penjualan `monthly_invoice` tanpa invoice (orphan) | ✅ 0 |
| A2 | Penjualan menunjuk invoice yang tidak ada | ✅ 0 |
| A3 | `sale_items` yatim (sale hilang) | ✅ 0 |
| A4 | `client_assets` yatim (sale_item hilang) | ✅ 0 sejati* |
| A5 | `stock_movements` ref sale yang hilang | ✅ 0 |
| A6 | Invoice DRAFT tanpa penjualan tertaut (kosong) | ✅ 0 |
| A7 | `wallet_transactions` ref sale yang hilang | ✅ 0 |
| B1 | Nomor invoice kembar (per user) | ✅ 0 |
| B2 | Nomor invoice format tak standar | ✅ 0 |
| C1 | Total invoice ≠ Σ penjualan tertaut | ✅ 0 |
| C2 | Invoice lunas tanpa `paid_date`/`paid_wallet` | ✅ 0 |
| C3 | Penjualan tunai/transfer tanpa wallet | ✅ 0 |
| C4 | Saldo wallet negatif | ✅ 0 |
| C5 | Penjualan terhutang lunas tanpa `paid_wallet` | ✅ 0 |
| D1 | Produk stok negatif | ✅ 0 |
| D2 | Produk jasa punya `stock_movements` | ✅ 0 |

\* **A4 false-positive:** 6 `client_assets` memiliki `sale_item_id = NULL` **secara
sengaja** (FK `ON DELETE SET NULL`). Semuanya aset lama milik *Rob Peetoom Seminyak*
(tanggal 2014–2024, jauh sebelum sistem) yang dientri manual — bukan sisa data rusak.
Orphan sejati (`sale_item_id` non-null menunjuk item hilang) = **0**.

**Kesimpulan.** 🟢 **Integritas data bersih.** Bug yang sempat ditemukan belakangan
— penjualan orphan (DJI Osmo) & nomor invoice kembar — sudah dituntaskan dan **tidak
menyisakan residu**. Fungsi pembalik (`delete_sale`, `delete_monthly_invoice`) kini
konsisten membalik stok/aset/wallet.

**Rekomendasi.**
- 🟡 **R1.1 — Jadikan scan ini fitur permanen.** Sistem sudah 2× kena anomali yang
  baru ketahuan saat dipakai (nomor kembar, orphan sale). Untuk sistem full-online,
  buat **halaman "Pemeriksaan Data" (admin)** atau **cron mingguan** yang menjalankan
  16 pemeriksaan di atas dan menandai bila ada yang > 0. Deteksi dini jauh lebih murah
  daripada menemukannya lewat laporan yang janggal. (Query sudah tersedia di riwayat
  audit ini — tinggal dijadikan view/RPC.)
- 🟡 **R1.2 — Tinjau ulang perilaku `ON DELETE` `client_assets.sale_item_id`.**
  Saat ini `SET NULL`. Artinya bila sebuah `sale_item` terhapus lewat jalur yang tak
  ikut menghapus asetnya, aset akan tetap ada dan **menyaru sebagai aset manual**.
  `delete_sale` sudah menghapus aset lebih dulu (aman), tapi jalur lain di masa depan
  bisa lolos. Pertimbangkan: kolom penanda "aset manual" eksplisit, agar aset manual
  yang sah bisa dibedakan dari aset yatim akibat bug.

---

## Tahap 2 — Keamanan ✅

**Cakupan.** Baca-saja: status RLS + policy tiap tabel, filter `auth.uid()` pada
RPC `SECURITY DEFINER`, keamanan view (`security_invoker`), grant ke role
`anon`/`authenticated`, penyimpanan kredensial, dan sisi kode (service-role key,
env, `.gitignore`).

### 🟢 Yang sudah baik
- **RLS aktif di 26/26 tabel**, dan **semua policy memfilter `auth.uid()`** — tak
  ada tabel transaksional yang terbuka.
- **RPC bisnis & kredensial memfilter `auth.uid()`**: `create_sale`, `delete_sale`,
  `pay_sale`, `mark_invoice_paid`, `reveal_*` (email/network/cctv/wifi), dll —
  semuanya per-user, tak bisa dipakai lintas-user.
- **Sisi kode bersih**: service-role key hanya di route server `api/keep-alive`
  (tak pernah ke klien); `NEXT_PUBLIC_*` hanya URL + anon key (memang publik);
  `.env*` di-`.gitignore` dan **tak ada file env ter-commit**.

> ✅ **STATUS: SUDAH DIPERBAIKI (2026-08-18)** — migrasi
> `20260818_security_views_invoker_and_revoke_crypto.sql` diterapkan ke DB produksi.
> 2.1: 9 view kini `security_invoker=on` (diverifikasi; simulasi role `authenticated`
> uid asing → 0 baris). 2.2: EXECUTE `encrypt/decrypt_secret` dicabut dari
> anon/authenticated/public (diverifikasi bersih). Fitur aplikasi tak terpengaruh.
> 🟡 2.3 & 2.4 **belum** dikerjakan (opsional/aman).

### 🔴 2.1 — KRITIS: 9 view mem-bypass RLS DAN terekspos ke `anon`/`authenticated`
Kesembilan view (`v_wallet_balances`, `v_monthly_invoices`, `v_client_assets`,
`v_network_credentials`, `v_cctv_systems`, `v_maintenance_contracts`, `v_rab_summary`,
`v_product_stock`, `v_products_in_stock`) memiliki:
- `security_invoker = off` → view berjalan sebagai **pemilik (postgres)** →
  **mem-bypass RLS** tabel dasar; **dan**
- tidak memfilter `auth.uid()` sendiri; **dan**
- `GRANT SELECT` (bahkan INSERT/UPDATE/DELETE/TRUNCATE) ke **`anon` dan `authenticated`**.

**Dampak.** Anon key itu **publik** (tertanam di frontend yang ter-deploy). Siapa pun
di internet yang mengambil anon key bisa memanggil REST Supabase, mis.
`GET /rest/v1/v_wallet_balances?select=*` atau `v_network_credentials`, dan
**membaca seluruh data tanpa login** — RLS tak berlaku karena view-nya bypass.
Terekspos: saldo & mutasi wallet, invoice, aset client, kontrak maintenance,
metadata kredensial jaringan/CCTV. Walau sekarang **single-user** (jadi yang bocor
"hanya" data pemilik), ini **tetap kebocoran nyata & bisa dieksploitasi sekarang**,
dan makin berbahaya saat multi-user.

**Perbaikan (disarankan — belum diterapkan):**
```sql
-- Jadikan view menghormati RLS penanya (PG15+, Supabase memenuhi):
alter view public.v_wallet_balances       set (security_invoker = on);
alter view public.v_monthly_invoices       set (security_invoker = on);
alter view public.v_client_assets          set (security_invoker = on);
alter view public.v_network_credentials    set (security_invoker = on);
alter view public.v_cctv_systems           set (security_invoker = on);
alter view public.v_maintenance_contracts  set (security_invoker = on);
alter view public.v_rab_summary            set (security_invoker = on);
alter view public.v_product_stock          set (security_invoker = on);
alter view public.v_products_in_stock      set (security_invoker = on);
-- (Opsional, pengerasan) cabut hak tulis lewat view & akses anon bila tak perlu:
-- revoke insert, update, delete, truncate, references, trigger
--   on all tables in schema public from anon, authenticated;
```
Setelah `security_invoker=on`, view mengikuti RLS: anon (tanpa sesi) tak dapat baris,
authenticated hanya baris miliknya. Aplikasi **tetap jalan** (semua akses via sesi
login), jadi ini aman diterapkan.

### 🟠 2.2 — `encrypt_secret` / `decrypt_secret` bisa dipanggil `anon`/`authenticated`
Kedua helper pgcrypto ini `SECURITY DEFINER`, **tidak** memfilter `auth.uid()`, dan
**`EXECUTE`-nya di-grant ke `anon` & `authenticated`**. Artinya siapa pun (via anon
key) bisa memanggil `decrypt_secret(<ciphertext>)`. Digabung dengan 2.1 (ciphertext
kredensial bisa terbaca lewat view), ini bisa berujung **pembongkaran password
kredensial**. Interface yang benar adalah `reveal_*` (sudah cek `auth.uid()`), jadi
helper mentah ini tak perlu terekspos.

**Perbaikan (disarankan):**
```sql
revoke execute on function public.encrypt_secret(text) from anon, authenticated, public;
revoke execute on function public.decrypt_secret(text) from anon, authenticated, public;
-- (sesuaikan tanda tangan argumen bila berbeda)
```
`reveal_*`, `save_*`, `upsert_*` tetap jalan (mereka `SECURITY DEFINER`, memanggil
helper sebagai pemilik) — tak ada fitur yang rusak.

### 🟡 2.3 — Hak tulis view untuk `anon`/`authenticated`
Grant view menyertakan INSERT/UPDATE/DELETE/TRUNCATE. Untuk view sederhana yang
auto-updatable, ini berpotensi menulis ke tabel dasar dengan mem-bypass RLS. Setelah
2.1 diperbaiki risikonya turun, tetapi sebaiknya batasi grant view ke **SELECT saja**.

### 🟡 2.4 — Tabel `keep_alive` RLS ON tanpa policy
Terkunci total (deny-all ke non-owner). **Aman**, dicatat sebagai informasi;
diakses hanya oleh route server memakai service-role key.

### Catatan env produksi (perlu dipastikan manual di Vercel — tak terlihat dari sini)
- `CREDENTIALS_SECRET_KEY` **wajib** ada (kunci dekripsi kredensial).
- `SUPABASE_SERVICE_ROLE_KEY` hanya sebagai server env (jangan `NEXT_PUBLIC_`).
- Pertimbangkan **rotasi anon key** setelah 2.1 diperbaiki (karena selama ini anon
  key bisa membaca data lewat view yang bocor).

---

## Tahap 3 — Alur Bisnis & Efisiensi Input ⬜ BELUM

**Rencana cakupan:**
- Hitung jumlah langkah/klik per skenario nyata (mis. beli→jual→invoice→lunas).
- Identifikasi **input berulang** (nama & harga barang diketik 2× di Pembelian lalu
  Penjualan untuk kasus beli-untuk-jual).
- Usulan jalan pintas: form **"Transaksi Cepat"** (beli+jual+aset dalam 1 langkah)
  tanpa mengorbankan akurasi HPP/laporan.
- Konsistensi status (RAB `done` mengakui laba; invoice draft→sent→paid).

**Temuan:** _(belum diaudit)_

---

## Tahap 4 — UX/UI & Desain ⬜ BELUM

**Rencana cakupan:**
- Navigasi antar-menu & kedalaman alur.
- Kepadatan form (sebagian sudah dirapikan Agu 2026), konsistensi komponen Base UI.
- Keterbacaan di layar kecil (mobile), mode gelap.
- Umpan balik aksi (toast, status kirim email), keadaan kosong (empty state).

**Temuan:** _(belum diaudit)_

---

## Lampiran — Daftar pemeriksaan integritas data (agar dapat diulang)

Kelas anomali yang discan pada Tahap 1 (bisa dijadikan view/RPC untuk R1.1):
A1 orphan sale invoice · A2 sale→invoice hilang · A3 sale_items yatim ·
A4 client_assets yatim (kecualikan `sale_item_id IS NULL` yang sah) ·
A5 stock_movements→sale hilang · A6 invoice draft kosong ·
A7 wallet_tx→sale hilang · B1 nomor invoice kembar · B2 format nomor ·
C1 total invoice vs Σ sales · C2 invoice paid tanpa paid_date/wallet ·
C3 sale cash/transfer tanpa wallet · C4 saldo wallet negatif ·
C5 terhutang paid tanpa wallet · D1 stok negatif · D2 jasa punya stock_movements.
