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
| 3 | Alur Bisnis & Efisiensi Input | ✅ SELESAI (2026-08-18) | Otomatisasi sudah kuat; friction utama: beli→jual→invoice lintas 3 menu → usul "Transaksi Cepat" + 4 perbaikan kecil |
| 4 | UX/UI & Desain | ✅ SELESAI (2026-08-18) | Matang (responsif+PWA+dark mode+empty/toast konsisten); 🟠 `confirm()` native 18 file + 🟡 input rupiah tanpa pemisah ribuan & 3 kecil |

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

## Tahap 3 — Alur Bisnis & Efisiensi Input ✅

**Cakupan.** Telaah form nyata ([purchase-form](../src/app/(app)/purchases/purchase-form.tsx),
[sale-form](../src/app/(app)/sales/sale-form.tsx), [invoice-list](../src/app/(app)/invoices/invoice-list.tsx))
+ struktur menu, menghitung langkah per skenario, mencari input berulang.

### 🟢 Otomatisasi yang sudah baik (jangan dibongkar)
- **Produk auto-dibuat & digabung** saat Pembelian (ketik nama, tak perlu bikin
  master produk dulu).
- **Harga jual & garansi auto-terisi** di Penjualan dari default produk.
- **Invoice bulanan auto-terbentuk & auto-gabung** (client+periode+jatuh tempo sama).
- **Tandai Lunas** otomatis kirim email + catat netto (setelah PPh) ke wallet.
- **Stok, aset client, mutasi wallet** semuanya otomatis dari 1 aksi.

> Penting: langkah beli → jual → invoice **memang** memetakan 3 peristiwa akuntansi
> (modal/HPP · pendapatan+stok keluar · kas masuk). Tujuan audit = pangkas **input
> berulang & lompatan menu**, bukan menggabung paksa yang merusak akurasi laporan.

### Hitung langkah — skenario "beli printer 1jt, jual 2jt (invoice bulanan)"
| Tahap | Menu | Interaksi kira-kira |
|-------|------|---------------------|
| Pembelian | Pembelian | ~8–11 (buka form, distributor, wallet, nama, qty, harga, [buka adv+harga jual], simpan) |
| Penjualan | Penjualan | ~9 (buka form, client, metode, pilih barang, harga auto, simpan) |
| Pelunasan* | Invoice Bulanan | ~3 (buka, Eye→detail, Tandai Lunas → email otomatis) |

\* Pelunasan terjadi **nanti** saat client bayar — bukan bagian dari input di saat deal.
Jadi beban input **saat transaksi = 2 menu, ~18–20 interaksi**.

### 🟠 3.1 — Kasus "beli-untuk-langsung-jual" lintas 2–3 menu
Untuk reseller yang inti bisnisnya **beli lalu jual ke client tertentu** (persis
contoh printer), operasi paling sering ini justru jalurnya paling panjang: pindah
menu Pembelian → Penjualan (→ Invoice). Nama barang diketik di Pembelian lalu dipilih
lagi di Penjualan; harga jual bisa diisi di Pembelian **atau** Penjualan.

**Usulan — form "Transaksi Cepat / Beli & Jual Sekaligus"** (opsional, tidak
menghapus menu lama):
- Satu dialog: distributor + wallet-bayar + tanggal · **item: nama, qty, harga beli,
  harga jual** · client + metode jual (+ periode/jatuh tempo/wallet-terima).
- Submit → jalankan `create_purchase` lalu `create_sale` dalam **satu transaksi**
  (idealnya RPC baru `create_quick_deal` agar tak setengah jadi bila gagal). Stok
  bersih 0, modal & margin tetap tercatat benar.
- Hasil: 1 menu, ~10–12 interaksi (turun ±40%). Menu Pembelian/Penjualan biasa tetap
  ada untuk beli-stok-simpan & jual-dari-stok.

### 🟡 3.2 — Harga jual saat Pembelian tersembunyi
"Harga Jual Default" ada di balik ikon `SlidersHorizontal` (opsi lanjutan), sehingga
banyak yang tak menemukannya → harga jual baru diisi saat Penjualan (input tertunda).
Usulan: munculkan kolom "Harga jual" langsung di baris (atau minimal beri hint), agar
sekali ketik saat beli, otomatis terpakai saat jual.

### 🟡 3.3 — Client baru memaksa keluar dari form Penjualan
Penjualan mengharuskan client sudah ada di Master Data. Bila client baru, user harus
ke menu Client dulu lalu kembali. Usulan: tombol **"+ Client baru"** inline di form
Penjualan (mini-dialog), sama untuk Distributor di Pembelian.

### 🟡 3.4 — Metode bayar default selalu "cash"
Untuk client langganan invoice bulanan (mis. grup Rob Peetoom), default `cash` bikin
tiap input harus ganti metode. Usulan: ingat metode terakhir, atau **default metode
per-client** (mis. client bertanda "langganan invoice").

### 🟡 3.5 — Pelunasan invoice harus masuk halaman detail
Dari daftar Invoice, tandai-lunas hanya di halaman detail (Eye → detail → Tandai
Lunas). Itu wajar (perlu review sebelum email terkirim). Opsional: aksi **"Tandai
Lunas" langsung di baris** daftar untuk invoice yang sudah pasti, dengan konfirmasi.

**Kesimpulan.** 🟢 Fondasi otomatisasi kuat; tak ada yang "salah". Peningkatan terbesar
= **form Transaksi Cepat (3.1)** untuk pola beli-untuk-jual, disusul perbaikan kecil
3.2–3.5 yang menghemat perpindahan menu & klik.

---

## Tahap 4 — UX/UI & Desain ✅

**Cakupan.** Telaah kode: layout & navigasi ([layout](../src/app/(app)/layout.tsx),
[sidebar-nav](../src/components/shared/sidebar-nav.tsx),
[app-header](../src/components/shared/app-header.tsx),
[bottom-nav](../src/components/shared/bottom-nav.tsx)), tema
([globals.css](../src/app/globals.css)), PWA ([manifest](../src/app/manifest.ts)),
pola empty/loading/toast, aksesibilitas, input.

### 🟢 Yang sudah matang
- **Responsif menyeluruh**: sidebar di desktop; di mobile hamburger + `Sheet` untuk
  menu lengkap **dan** bottom-nav 4 menu tersering. **Safe-area** ditangani (notch,
  home-indicator) — jarang ada di app internal.
- **PWA installable**: manifest lengkap (`standalone`, `portrait`, ikon `any` +
  `maskable`, `theme_color` teal), `@serwist` terpasang.
- **Tema terang + gelap** berbasis token CSS (oklch), aksen teal, `ThemeToggle`.
- **Komponen bersama konsisten**: `EmptyState`, `StatCard`/`SummaryCard`,
  `PaginationBar`, spinner `Loader2`, toast `sonner`, `global-search`.
- **A11y dasar**: `sr-only` label, `aria-label` pada banyak tombol ikon, judul Sheet.

### 🟠 4.1 — Konfirmasi hapus memakai `confirm()` native (18 file)
Aksi destruktif (hapus penjualan/pembelian/invoice/produk/client/dst) memakai
`window.confirm()` bawaan browser — **tidak selaras** dengan sistem `Dialog` yang
sudah rapi: tak ikut tema (gelap/terang), tampilan kaku, memblok thread, dan di
sebagian browser mobile perilakunya tak konsisten. Untuk app full-online harian ini
titik paling terasa. **Usulan:** satu komponen **`ConfirmDialog`** (Base UI
`AlertDialog`) reusable, ganti ke-18 pemakaian `confirm()`.

### 🟡 4.2 — Input rupiah tanpa pemisah ribuan
Kolom nominal memakai `type="number"` mentah (≈28 tempat) → mengetik `6050000` tanpa
titik ribuan rawan salah (kelebihan/kurang nol) untuk angka jutaan. **Usulan:**
komponen **input mata-uang** yang menampilkan `6.050.000` saat diketik (nilai asli
tetap number), dipakai bersama di form Pembelian/Penjualan/Pengeluaran/RAB.

### 🟡 4.3 — Bottom-nav mobile hanya 4 menu
Dashboard & Invoice Bulanan tak ada di bottom-nav (harus lewat hamburger). Wajar
(slot terbatas), tapi pertimbangkan slot ke-5 "Menu"/"Lainnya" atau sesuaikan dengan
menu tersering dipakai.

### 🟡 4.4 — Sebagian tombol ikon di tabel tanpa `aria-label`/`title`
Mayoritas tombol ikon sudah beri label, tapi beberapa (mis. tombol hapus di beberapa
daftar) hanya ikon tanpa `aria-label`/`title` → pembaca layar tak tahu fungsinya.
Perbaikan cepat, konsistenkan semua.

### 🟡 4.5 — Campur warna palet Tailwind dengan token tema
Banyak tempat memakai `text-emerald-600`/`bg-amber-50` langsung; sebagian sudah beri
varian `dark:`, sebagian belum → potensi kontras kurang di mode gelap. **Usulan:**
token semantik (`success`/`warning`/`info`) agar konsisten terang & gelap.

**Kesimpulan.** 🟢 UX/UI tergolong **matang** untuk app bisnis internal (responsif,
PWA, dark mode, komponen konsisten). Perbaikan bersifat pemolesan: **4.1 ConfirmDialog**
paling berdampak, disusul **4.2 input rupiah** (mengurangi salah ketik uang).

---

## Ringkasan Prioritas Tindakan (lintas tahap)

Diurut dari paling mendesak. Audit = laporan; penerapan menunggu keputusan pemilik.

| Prioritas | Item | Tahap | Status |
|-----------|------|-------|--------|
| 🔴 1 | View bypass RLS terekspos publik (2.1) | 2 | ✅ **sudah diperbaiki** |
| 🟠 2 | Helper kripto terekspos (2.2) | 2 | ✅ **sudah diperbaiki** |
| 🟠 3 | Rotasi anon key Supabase (tindak lanjut 2.1) | 2 | ⬜ dashboard (pemilik) |
| 🟠 4 | Form "Transaksi Cepat" beli+jual (3.1) | 3 | ⬜ dipikirkan pemilik |
| 🟠 5 | Ganti `confirm()` → `ConfirmDialog` (4.1) | 4 | ⬜ |
| 🟡 6 | Fitur "Pemeriksaan Data" / cron integritas (R1.1) | 1 | ⬜ |
| 🟡 7 | Input rupiah berpemisah ribuan (4.2) | 4 | ⬜ |
| 🟡 8 | Perbaikan kecil alur (3.2–3.5) | 3 | ⬜ dipikirkan pemilik |
| 🟡 9 | Batasi grant tulis view ke SELECT (2.3) | 2 | ⬜ |
| 🟡 10 | A11y tombol ikon, token warna semantik (4.4–4.5) | 4 | ⬜ |

**Penilaian keseluruhan.** Sistem **sehat & siap full-online** setelah lubang
keamanan kritis (2.1/2.2) ditutup. Integritas data bersih, otomatisasi bisnis kuat,
UX matang. Sisa item adalah peningkatan efisiensi & pemolesan — bukan penghambat.

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
