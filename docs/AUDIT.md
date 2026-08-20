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
| 5 | Kebenaran Akuntansi (Profit·Piutang/Hutang·Wallet·Lifecycle·Client360) | ✅ SELESAI (2026-08-20) | Wallet & data rekonsiliasi **sempurna**; **🔴 5.1 laba KAS salah → ✅ DISATUKAN ke akrual** (Dashboard + tab Ringkasan; Juli kas 8,97jt→akrual 5,9jt, beda 3,07jt); **✅ 5.3 `mark_invoice_paid` 3-arg dihapus · ✅ 5.4 `delete_purchase` bergaransi stok**; **✅ 5.6 halaman /piutang + kartu Client 360 + Dashboard piutang fixed**; sisa 🟠 hutang distributor ditunda-fitur (5.2) · 🟡 5.5/5.7 keputusan desain |

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

## Tahap 5 — Kebenaran Akuntansi ✅

**Cakupan.** Berbeda dari Tahap 1 (integritas data / apakah ada baris rusak), tahap ini
menguji **kebenaran logika akuntansi** (apakah hitungan cocok dengan kenyataan). Baca-saja
ke DB produksi (via `pg` + `SUPABASE_DB_URL`): membaca **sumber semua RPC uang**
(`create_sale`, `create_purchase`, `delete_sale`, `delete_purchase`, `pay_sale`,
`mark_invoice_paid`, `delete_monthly_invoice`, `create_quick_deal`), modul laporan
([profit-loss](../src/lib/reports/profit-loss.ts), [transactions](../src/lib/reports/transactions.ts)),
lalu **rekonsiliasi angka nyata** (saldo wallet, HPP, piutang). Lima area yang diminta pemilik:
① Accounting & Profit ② Piutang & Hutang ③ Cash/Wallet ④ Sales & Purchase Lifecycle ⑤ Client 360.

**Snapshot produksi (2026-08-20).** 1 wallet (saldo **9.427.647**) · penjualan
45.604.000 · pembelian 30.579.902 · HPP barang terjual 30.579.902 · piutang berjalan
(terhutang 3.975.000 + invoice draft 31.479.000) · 1 proyek RAB **berjalan** (termin
30.000.000 sudah diterima, belum selesai).

### 🟢 Yang sudah BENAR (terbukti lewat rekonsiliasi)
- **Saldo wallet rekonsiliasi 100%.** `v_wallet_balances` = `initial_balance` + Σ(income+transfer_in) − Σ(expense+transfer_out); dihitung ulang independen → **sama persis** (9.427.647). Semua RPC uang menulis `wallet_transactions` yang konsisten.
- **Revenue recognition (akrual) benar** di Laporan Laba Rugi: penjualan diakui saat `sale_date`; proyek RAB **hanya** saat status `done`; termin proyek **berjalan** TIDAK diakui sebagai laba (dipisah ke bagian D).
- **Expense TIDAK dobel** di Laba Rugi: pembelian → **persediaan** (bukan biaya), baru jadi **HPP** saat barang benar-benar terjual (`sale_items.cost_price` terkunci saat jual). Operasional/pribadi/PPh dihitung sekali; RAB expense hanya masuk HPP proyek selesai. Penjualan `monthly_invoice` sengaja **tidak** dijumlah ulang di Riwayat (dipakai baris pelunasan) via `countInTotal`.
- **Lifecycle simetris/reversibel:** `delete_sale` & `delete_monthly_invoice` membalik stok+aset+wallet; `delete_sale` menolak bila invoice sudah lunas; `create_quick_deal` (beli+jual) berjalan dalam **satu transaksi** (atomik, HPP terkunci benar).

### 🔴 5.1 — KRITIS: Dashboard memakai laba **metode KAS** yang salah → beda dari laporan benar
> ✅ **STATUS: SUDAH DIPERBAIKI (2026-08-20) — Dashboard & tab Ringkasan Laporan.**
> Semua tampilan **laba** kini memakai `getProfitLoss`/`getProfitLossTrend` (server
> action pembungkus `buildProfitLoss`) — **satu sumber angka**, sama dengan tab Laba Rugi:
> - **Dashboard**: kartu **Laba Bersih** & **Margin** + garis **"Laba"** grafik tren.
> - **Laporan → tab "Ringkasan"**: kartu **Laba Bersih** & **Margin**, teks rumus laba
>   (kini "Pendapatan − HPP − Operasional − Pribadi [− PPh]"), grafik **"Penjualan vs
>   Pengeluaran per Bulan"** & **"Laba Bersih per Bulan"** — semua akrual & saling cocok
>   (revenue − expense = net). Gauge **BALANCE/CASH FLOW/SPENDING** sengaja tetap metrik
>   **kas** (angka saja). **Catatan otomatis** kini diletakkan **tepat di bawah kartu
>   ringkasan** (bukan di gauge, agar tak dobel & mudah dilihat): bila kas ≠ laba akrual,
>   muncul penanda kuning "**Kas bersih bulan ini Rp X — lebih Rp Y dari Laba Bersih**",
>   dengan rincian uang muka **proyek berjalan** (sisa `remaining`) yang belum jadi laba.
>   **Hilang sendiri** saat selisih = 0. Contoh Juli: kas 8.973.381, lebih 3.075.001 dari
>   laba 5.898.380 (= sisa uang muka proyek); Agustus tak ada catatan.
> - Kartu kas (Total Penjualan/Pembelian/Pengeluaran/Saldo Masuk) tetap dari
>   `finance_summary` karena memang angka kas yang berlabel benar.
>
> Diverifikasi: Juli 2026 turun dari **8.973.381** (kas, salah) → **5.898.380** (akrual,
> = laporan & = angka `buildProfitLoss` historis di CLAUDE.md); Agustus 2026 tetap
> **6.523.600** (bulan ini kas & akrual kebetulan sama). `tsc --noEmit` bersih.
> *(Verifikasi visual di app tak bisa — halaman di balik login.)*

Aplikasi menampilkan **DUA angka laba yang berbeda** untuk periode yang sama:
- **Dashboard** ("Laba Bersih", "Margin Laba", grafik tren "Laba") memanggil RPC lama
  **`finance_summary`** — rumusnya berbasis kas:
  `(penjualan + SEMUA termin RAB) − (SEMUA pembelian + biaya RAB) − operasional − pribadi`.
  ([dashboard-client.tsx:57,80,97](../src/app/(app)/dashboard/dashboard-client.tsx) + juga masih dipanggil di [reports-client.tsx:127,132](../src/app/(app)/reports/reports-client.tsx)).
- **Laporan Keuangan → Laba Rugi** memakai [`buildProfitLoss`](../src/lib/reports/profit-loss.ts) — akrual & benar (dibangun 2026-08-02, sudah dicocokkan dengan Excel pemilik).

**Dampak nyata (bukan teori).** Contoh **Juli 2026**: proyek RAB **berjalan** menerima
termin **30.000.000** dan sudah keluar biaya **26.924.999** di bulan sama. `finance_summary`
(kas) menghitung **net** kas proyek itu (+3.075.001) sebagai laba, padahal proyek **belum
selesai** → laba kas **8.973.381** vs laba akrual benar **5.898.380** → **beda 3.075.001**
(persis = sisa uang muka proyek yang belum jadi laba). Arah error bisa terbalik juga: saat
ada **stok belum terjual**, `finance_summary` menghitung seluruh pembelian sebagai biaya →
laba **kurang-hitung**. Inilah **sumber langsung** kekhawatiran "hitungan keuangan berbeda
dari kenyataan". (Selaras rujukan historis CLAUDE.md: selisih ±3 jt.)

**Rekomendasi (belum diterapkan).** Jadikan **satu sumber angka**: pensiunkan
`finance_summary` dari Dashboard & Reports, ganti kartu laba/margin/tren memakai hasil
`buildProfitLoss` (akrual). `finance_summary` boleh disimpan hanya sebagai "arus kas
periode" bila memang perlu, **dengan label tegas "kas", bukan "laba"**.

### 🟠 5.2 — HUTANG ke distributor tidak ada konsepnya (pembelian selalu tunai)
`create_purchase` **selalu** memotong wallet seketika sebesar total; tabel `purchases`
tak punya kolom status-bayar / jatuh tempo. Artinya bila pemilik **beli tempo** (bayar
belakangan ke distributor), saldo wallet **langsung berkurang** padahal uang masih di
bank → **saldo ≠ kenyataan** sampai benar-benar dibayar, dan tak ada daftar "hutang
usaha". Piutang (uang client ke kita) sudah tertangani, tapi sisi Hutang belum.
**Rekomendasi:** bila praktik beli-tempo memang terjadi, tambahkan status bayar pada
pembelian (mirip `terhutang` di penjualan) + wallet baru berkurang saat pelunasan.
Bila **selalu bayar tunai/transfer saat beli**, cukup dicatat sebagai keputusan sadar.

> 📌 **Konfirmasi pemilik (2026-08-20).** Praktik beli-tempo **memang ada** — distributor
> **"Cetak Ide"** selalu dibeli **terhutang**, dibayar **akhir bulan**. Efek saat ini:
> pembelian Cetak Ide langsung memotong wallet di tanggal beli (bukan saat bayar akhir
> bulan) → **saldo wallet understated** sepanjang bulan; totalnya benar (tak dobel), hanya
> **timing** yang meleset. **Keputusan pemilik: ditunda jadi FITUR pasca-audit.**
> Ruang lingkup fitur yang diinginkan (lebih dari sekadar status bayar):
> **portal login untuk distributor Cetak Ide** — Cetak Ide meng-input pembelian sendiri
> (hanya mengisi **harga beli**); barang otomatis masuk **Stok** pemilik; pemilik lalu
> menambahkan **harga jual** (marginnya). Termasuk juga penagihan/pelunasan akhir bulan
> sebagai **hutang usaha**. Dicatat untuk dikerjakan **setelah audit selesai**.

### 🟠 5.3 — `mark_invoice_paid` punya **dua versi** hidup bersamaan (risiko bruto ≠ netto)
> ✅ **SUDAH DIPERBAIKI (2026-08-20)** — migrasi
> `20260820_mark_invoice_paid_drop_3arg_and_delete_purchase_guard.sql`:
> `DROP FUNCTION mark_invoice_paid(uuid,uuid,date)`. Kini **tinggal satu** versi
> (5-arg netto + PPh). Panggilan bergaya 3-arg tetap jalan lewat DEFAULT arg 4&5
> (pph_base=0 → netto=total), jadi tak ada fitur yang rusak — hanya jalur
> bruto-tanpa-PPh yang hilang. Diverifikasi via `pg_proc`: overload = 1.

Ada 2 fungsi: `mark_invoice_paid(uuid,uuid,date)` (3-arg) mencatat **BRUTO tanpa PPh**,
dan `mark_invoice_paid(uuid,uuid,date,numeric,numeric)` (5-arg) mencatat **NETTO + PPh**.
App selalu memanggil **5-arg** ([invoices/actions.ts:46](../src/app/(app)/invoices/actions.ts)) → **benar**. Tapi versi 3-arg **masih terekspos** sebagai RPC; bila terpanggil (kode masa depan / panggilan manual), wallet menerima **bruto** (tak cocok mutasi bank) dan PPh hilang dari laporan.
**Rekomendasi:** `DROP FUNCTION public.mark_invoice_paid(uuid,uuid,date);` (sisakan hanya 5-arg).

### 🟠 5.4 — `delete_purchase` tidak cek apakah stok pembelian sudah terjual
> ✅ **SUDAH DIPERBAIKI (2026-08-20)** — migrasi yang sama. `delete_purchase`
> di-`CREATE OR REPLACE` (tanda tangan sama) dengan **guard**: menolak hapus bila
> stok produk saat ini < qty yang ditambah pembelian itu (`current_stock < qty_in`
> lewat `v_product_stock`) → berarti barang sudah terjual. Pesan jelas ("stok "X"
> tinggal N … Hapus penjualannya dulu") diteruskan ke UI via `error.message`
> ([purchases/actions.ts:118](../src/app/(app)/purchases/actions.ts)). Diverifikasi:
> guard aktif, dan pembelian lama yang barangnya sudah terjual (stok 0) kini
> terlindung dari penghapusan yang tadinya membuat stok negatif. Pembalikan
> stok/wallet + cascade `purchase_items` tak berubah.

`delete_purchase` menghapus `stock_movements` + `wallet_transactions` pembelian tanpa
memeriksa apakah barangnya **sudah keluar** lewat penjualan. Menghapus pembelian yang
barangnya sudah terjual → **stok bisa negatif** dan `cost_price` pada penjualan lama
tetap mengunci harga dari pembelian yang sudah tak ada (HPP menggantung).
**Rekomendasi:** tolak hapus pembelian bila akan membuat stok produk terkait < 0 (atau
bila sudah ada penjualan produk itu setelah tanggal pembelian). (Saat ini D1 stok
negatif = 0, jadi **belum** terjadi — ini pencegahan.)

### 🟡 5.5 — HPP memakai "harga beli TERAKHIR", bukan FIFO/rata-rata
`create_sale` mengunci `cost_price = products.last_purchase_price` **saat jual**. Bila
harga beli barang yang sama berubah antar pembelian, HPP unit lama bisa meleset dari
modal riilnya (mengunci harga terbaru untuk semua unit tersisa). Untuk volume kecil
umumnya dapat diterima; **catat sebagai keterbatasan metode**, bukan bug. Bila akurasi
margin per-unit penting, pertimbangkan biaya rata-rata bergerak.

### 🟡 5.6 — Piutang belum ada laporan terkonsolidasi + tak muncul di Client 360
> ✅ **SUDAH DIPERBAIKI (2026-08-20).**
> - **Halaman "Piutang"** baru (menu Analisa → `/piutang`): 3 kartu ringkas (Total
>   Piutang · Invoice belum lunas · Penjualan terhutang) + tabel gabungan (client,
>   jenis, jatuh tempo + **umur/lewat berapa hari**, jumlah) dengan pencarian.
>   Server component `piutang/page.tsx` + `piutang-client.tsx`. Diverifikasi angka:
>   invoice 31.479.000 (3) + terhutang 3.975.000 (2) = **35.454.000**.
> - **Client 360**: kartu **"Piutang berjalan"** (snapshot saat ini, di luar filter
>   periode) = invoice belum lunas + terhutang belum lunas client itu; muncul hanya
>   bila > 0.
>
> ✅ **Temuan sampingan JUGA DIPERBAIKI (2026-08-20): Dashboard undercount Piutang.**
> `dashboard_counts.total_receivable` dulu **hanya** menjumlahkan penjualan metode
> `monthly_invoice` (invoice belum lunas) — **penjualan `terhutang` terlewat**. Migrasi
> `20260820_dashboard_counts_receivable_include_terhutang.sql` menambahkan terhutang
> belum lunas (`paid_date is null`). Diverifikasi: total_receivable kini **35.454.000**
> (31.479.000 invoice + 3.975.000 terhutang) = sama dengan halaman /piutang. Tanda tangan
> RPC tak berubah.

Data piutang lengkap (terhutang belum lunas + invoice belum lunas). **Client 360**
([client-360.tsx](../src/app/(app)/clients/[id]/client-360.tsx)) sudah bagus (profil,
omzet 12 bln, riwayat jual, invoice, laba per client & margin); kini + kartu piutang.

### 🟡 5.7 — Penjualan/Pembelian tidak bisa diedit (hanya buat & hapus)
Koreksi transaksi dilakukan dengan hapus lalu buat ulang. Konsisten & aman untuk
pembalikan, tapi memperbesar paparan ke 5.4 (hapus pembelian yang barangnya terjual)
dan merepotkan untuk salah ketik kecil. Catat sebagai keputusan desain; bila sering
salah ketik, pertimbangkan edit terbatas (field non-keuangan) tanpa mengubah efek stok/wallet.

### Checkpoint Tahap 5 (untuk dilanjutkan)
- [x] ① Accounting & Profit — revenue benar (akrual) · **expense TIDAK dobel** · HPP dari cost_price terjual · **🔴 laba dashboard salah (5.1)**
- [x] ② Piutang & Hutang — piutang terlacak (belum ada laporan, 5.6) · **hutang distributor tak ada (5.2)**
- [x] ③ Cash/Wallet — **saldo rekonsiliasi 100%** · transfer atomik · **dobel `mark_invoice_paid` (5.3)**
- [x] ④ Sales & Purchase Lifecycle — create/delete simetris · quick_deal atomik · **`delete_purchase` tak cek stok (5.4)** · tak bisa edit (5.7)
- [x] ⑤ Client 360 — sudah ada & lengkap · **tanpa piutang berjalan (5.6)**

**Kesimpulan.** 🟢 **Fondasi akuntansi kuat & internal-konsisten** — saldo wallet
rekonsiliasi sempurna, revenue akrual benar, expense tidak dobel, lifecycle reversibel.
**Satu masalah nyata & mendesak: 5.1** — Dashboard menampilkan laba metode kas yang
berbeda ±puluhan juta dari laporan yang benar. Ini **wajib** disatukan sebelum full-online
agar angka yang dilihat sehari-hari = kenyataan. Sisanya (5.2–5.4) penutup lubang
pencegahan, (5.5–5.7) keterbatasan/fitur.

---

## Ringkasan Prioritas Tindakan (lintas tahap)

Diurut dari paling mendesak. Audit = laporan; penerapan menunggu keputusan pemilik.

| Prioritas | Item | Tahap | Status |
|-----------|------|-------|--------|
| 🔴 1 | View bypass RLS terekspos publik (2.1) | 2 | ✅ **diperbaiki** |
| 🟠 2 | Helper kripto terekspos (2.2) | 2 | ✅ **diperbaiki** |
| 🟠 3 | Rotasi anon key Supabase (tindak lanjut 2.1) | 2 | ⬜ dashboard (pemilik) |
| 🟠 4 | Form "Transaksi Cepat" beli+jual (3.1) | 3 | ✅ **diimplementasikan** (RPC create_quick_deal + form) |
| 🟠 5 | Ganti `confirm()` → `ConfirmDialog` (4.1) | 4 | ✅ **diimplementasikan** (18 file) |
| 🟡 6 | Fitur "Pemeriksaan Data" (R1.1) | 1 | ✅ **diimplementasikan** (halaman /data-check; cron belum) |
| 🟡 7 | Input rupiah berpemisah ribuan (4.2) | 4 | ✅ **diimplementasikan** (CurrencyInput) |
| 🟡 8 | Perbaikan alur: 3.2 harga jual & 3.3 +Baru inline | 3 | ✅ **diimplementasikan** (3.4/3.5 belum) |
| 🔴 4b | Laba KAS salah → satukan ke akrual (5.1) | 5 | ✅ **diperbaiki** (Dashboard + tab Ringkasan Laporan) |
| 🟠 4c | Hapus overload `mark_invoice_paid` 3-arg (5.3) | 5 | ✅ **diperbaiki** |
| 🟠 4d | `delete_purchase` cegah stok negatif / barang sudah terjual (5.4) | 5 | ✅ **diperbaiki** |
| 🟠 4e | Konsep Hutang distributor / beli-tempo (5.2) | 5 | ⬜ (tergantung praktik) |
| 🟡 9 | Batasi grant tulis view ke SELECT (2.3) | 2 | ⬜ |
| 🟡 10 | A11y tombol ikon (4.4) + token semantik (4.5) | 4 | ✅ **diimplementasikan** |
| 🟡 11 | Laporan Piutang + kartu piutang di Client 360 (5.6) | 5 | ✅ **diimplementasikan** (halaman /piutang + kartu Client360 + Dashboard undercount piutang **fixed**) |
| 🟡 12 | Catatan metode HPP "harga terakhir" & edit transaksi (5.5/5.7) | 5 | ⬜ (keputusan desain) |

**Penilaian keseluruhan.** Sistem **sehat & internal-konsisten** — integritas data
bersih, **saldo wallet rekonsiliasi 100%**, revenue akrual benar, expense tidak dobel,
lifecycle reversibel, keamanan kritis (2.1/2.2) sudah ditutup. **Satu penghambat nyata
tersisa sebelum full-online: 5.1** — Dashboard menampilkan laba metode **kas** yang bisa
berbeda **puluhan juta** dari Laporan Laba Rugi yang benar. Menyatukan keduanya ke satu
sumber akrual adalah tindakan paling penting agar "angka sehari-hari = kenyataan".
Selebihnya penutup lubang pencegahan (5.2–5.4) & fitur/keterbatasan (5.5–5.7).

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
