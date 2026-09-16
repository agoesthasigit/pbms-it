# Redesign Mobile — "PBMS Saku" (fintech premium)

Dokumen kerja + **checkpoint** untuk redesign tampilan mobile PBMS-IT agar terasa
seperti aplikasi finansial terpasang (bukan web yang dikecilkan). Desktop **tidak
berubah**. Baca ini dulu sebelum melanjutkan pekerjaan mobile.

## Prinsip & arsitektur

- **Adaptive, bukan responsive murni.** Data, server action, RPC Supabase, dan PDF
  **dipakai bersama** desktop. Hanya lapisan tampilan yang bercabang → **nol tabel
  baru, nol beban DB/storage**.
- **Cara mencabangkan (WAJIB diikuti):**
  1. Halaman yang fetch di **server** (list): fetch **sekali**, lalu render dua
     presentasi dengan CSS — `hidden lg:block` (desktop, tabel lama) & `lg:hidden`
     (mobile, kartu). Tidak ada dobel-fetch.
  2. Halaman yang fetch di **klien** (dashboard/reports): fetch sekali di komponen
     induk, lalu render `<Mobile/>` (`lg:hidden`) + desktop (`hidden lg:block`)
     dari props yang sama.
  3. Untuk hal yang **tak boleh mount** di mobile (mis. grafik Recharts yang error
     saat kontainernya `display:none`), gunakan hook `useIsMobile()` (mengembalikan
     `undefined` sebelum mount → aman hydration) dan render bersyarat
     `{isMobile === false && <Chart/>}`.
- **Desain:** token & kelas berprefiks `ma-` di `src/app/globals.css`
  (bagian "DESIGN SYSTEM MOBILE"). Permukaan pakai token app (`--card`,
  `--background`, `--border`, `--muted-foreground`, `--foreground`) → otomatis
  ikut tema terang/gelap. Aksen (teal/oranye/pos/neg + gradien hero) lewat token
  `--m-*` (didefinisikan di `:root` untuk terang & `.dark` untuk gelap).
- **Warna:** teal (brand Athaya) sebagai primer, oranye (brand Cetak Ide) sebagai
  aksen sekunder. Berlaku di **light & dark**.
- **Pola native:** bottom-nav 4 tab + FAB tengah (buka bottom-sheet "Catat Baru"),
  kartu 18–24px, bottom-sheet menggantikan dialog, target sentuh besar, angka
  `tabular-nums` (kelas `.ma-num`).

## Komponen kunci (sudah ada)

- `src/app/globals.css` — design system `ma-*` + token `--m-*`.
- `src/components/shared/bottom-nav.tsx` — bottom-nav + FAB + sheet "Catat Baru"
  (khusus mobile; disembunyikan di lg via media query pada `.ma-bnav`).
- `src/components/shared/use-is-mobile.ts` — hook deteksi `< lg`.
- `src/lib/utils/currency.ts` — `formatIDR` (utuh) & `formatIDRShort` (Rp 21,4jt).
- `src/app/(app)/menu/page.tsx` — hub semua menu (sumber `NAV_GROUPS`).

## Cara menjalankan & verifikasi (E2E)

Worktree ini tak punya `node_modules` sendiri; sudah disambung (junction) ke
checkout utama + `.env.local` disalin. `next dev` default (Turbopack) menolak
junction, jadi pakai **webpack**:

```
npm run dev -- --webpack --port 3100
```

Verifikasi visual pakai **akun test E2E** (di `.env.local`: `E2E_TEST_EMAIL` /
`E2E_TEST_PASSWORD`) — login otomatis via Playwright lalu screenshot layar mobile.
Pola skrip: login (`#email`/`#password`/tombol "Masuk" → tunggu `**/dashboard`),
`newContext({ viewport:{width:390,height:844}, isMobile:true })`, screenshot.
`node node_modules/typescript/bin/tsc --noEmit` untuk typecheck (harus bersih).

## Rencana fase

Legenda: ✅ selesai · 🔶 sebagian · ⬜ belum · **Tier A** = mobile bespoke
(tabel→kartu), **Tier B** = sudah responsif, cukup verifikasi/poles.

### Fase 1 — Fondasi + Beranda ✅
- [x] Design system `ma-*` + token teal/oranye (light+dark)
- [x] Bottom-nav 4 tab + FAB + bottom-sheet "Catat Baru" (Beli→Jual→Pengeluaran→Invoice→Transfer)
- [x] Halaman **Menu** (hub semua fitur)
- [x] **Dashboard** mobile (hero laba, aksi cepat, KPI, tren, ringkasan, invoice/garansi)
- [x] Verifikasi E2E (light+dark) + tsc bersih

### Fase 2 — Tab inti lain ✅
- [x] **Riwayat Transaksi** (Tier A) — komponen mobile terpisah (`transaction-list-mobile.tsx`):
      ringkasan kompak Masuk/Keluar/Net, search + `FilterSheet`, kartu per transaksi
- [x] **Laporan** (Tier B) — terverifikasi responsif di mobile (period presets, tab, kartu, chart)
- [x] Komponen reusable `src/components/mobile/filter-sheet.tsx`
- [x] Verifikasi E2E + tsc bersih

### Fase 3 — List transaksi (Tier A) ✅
Pola: satu komponen (handler/dialog dipakai bersama), tabel dibungkus `hidden lg:block`,
tambah daftar kartu `lg:hidden` + ringkasan kompak `lg:hidden` (desktop `hidden lg:grid`) +
tombol toolbar diberi `flex-wrap`.
- [x] Pembelian (`purchase-list.tsx`) — kartu + expand item + hapus
- [x] Penjualan (`sale-list.tsx`) — kartu + expand item + aksi NOTA/Email/Lunas/Hapus + badge brand/status
- [x] Pengeluaran (`expenses-manager.tsx`) — kartu (ikon per jenis) + hapus
- [x] Verifikasi E2E (tanpa error) + tsc bersih. Catatan: akun test kosong, jadi
      daftar kartu ter-verifikasi secara struktur (tsc + tanpa runtime error), belum
      dengan data nyata.

### Fase 4 — Master data ✅
Keempatnya ternyata pakai tabel → semua Tier A (pola sama Fase 3).
- [x] Stok Barang (`products/product-manager.tsx`) — kartu (badge stok, harga, garansi) + aksi sesuaikan/riwayat/ubah/hapus
- [x] Aset Client (`assets/asset-manager.tsx`) — kartu (thumbnail foto + status garansi) + aksi repair/riwayat/ubah/hapus
- [x] Client (`clients/client-manager.tsx`) — kartu + tombol 360/ubah/hapus
- [x] Distributor (`distributors/distributor-manager.tsx`) — kartu + ubah/hapus
- [x] Verifikasi E2E (tanpa error) + tsc bersih

### Fase 5 — Layanan client ✅
Semua list pakai tabel → Tier A (pola sama Fase 3/4).
- [x] Invoice Bulanan (`invoices/invoice-list.tsx`) — kartu (brand+status badge, total) + Lihat/Hapus
- [x] Kontrak Maintenance (`maintenance/contract-manager.tsx`) — kartu (biaya/bln, tempo, status) + ubah/hapus
- [x] Network (`network/network-manager.tsx`) — kartu + `PasswordCell` (WiFi & perangkat) + repair/riwayat/ubah/hapus
- [x] CCTV (`cctv/cctv-manager.tsx`) — kartu (channel, user, `PasswordCell`) + repair/riwayat/ubah/hapus
- [x] RAB (`rab/rab-list.tsx`) — kartu (nilai/diterima/sisa/laba, status) + Lihat/Hapus
- [x] Verifikasi E2E (tanpa error) + tsc bersih
- **Belum (Fase 7):** `invoices/[id]/invoice-lines.tsx` (rincian baris invoice, masih tabel)
  & `rab/rab-editor.tsx` (form editor RAB panjang) — halaman detail/editor.

### Fase 6 — Analisa & sistem ✅
- [x] Piutang & Hutang (Tier A) — `piutang/piutang-client.tsx` (kartu + overdue) &
      `piutang/hutang-client.tsx` (kartu per nota + checkbox pilih, dialog bayar);
      `riwayat-bayar-client.tsx` sudah kartu responsif (tak diubah).
- [x] Pemeriksaan Data (Tier B) — sudah kartu hasil cek, verifikasi OK.
- [x] Pengaturan (Tier B) — tab (Kategori/Label/Email/Backup) + form + list kartu, verifikasi OK.
- [x] Pengajuan Distributor (Tier B) — sudah kartu + segmented tab (bukan tabel), verifikasi OK.
- [x] Verifikasi E2E (tanpa error) + tsc bersih.

### Fase 7 — Form & poles akhir 🔶
- [x] **Form full-screen di mobile** — kelas `.ma-dialog-full` (globals.css) dipakai di
      `sales/sale-form.tsx`, `purchases/purchase-form.tsx`, `purchases/quick-deal-form.tsx`
      (DialogContent). Full-screen < 640px, modal terpusat di desktop.
      **Gotcha Tailwind v4:** `-translate-x/y-1/2` memakai properti CSS `translate`
      (bukan `transform`) → reset WAJIB `translate: none !important` (bukan cuma
      `transform`). Diverifikasi: dialog box = {0,0,390,844} (full-screen).
- [x] **invoice-lines** (`invoices/[id]/invoice-lines.tsx`) — rincian baris tabel→kartu
      + baris Grand Total mobile.
- [ ] **Toolbar list → FilterSheet** (opsional): cari+tanggal di Pembelian/Penjualan/
      Pengeluaran/Stok masih stack (fungsional, agak panjang) — bisa dipindah ke
      `FilterSheet` seperti Transaksi.
- [ ] **rab-editor** (`rab/rab-editor.tsx`) — form editor panjang, tak pakai tabel;
      cek responsif bila dipakai intens di mobile.
- [ ] **Poles header mobile** (opsional): sapaan+avatar; hilangkan hamburger (redundan
      dgn tab Menu). Dialog pendek (expense/product/asset) bisa full-screen juga bila mau.
- [ ] **Portal distributor** (mobile) — aplikasi login terpisah `/portal`, di luar app pemilik.

## Checkpoint terakhir

> **Terakhir diperbarui:** Fase 1–6 SELESAI + Fase 7 inti (form full-screen &
> invoice-lines) SELESAI & terverifikasi (E2E + tsc bersih). Plus **FIX bug font**
> (Times New Roman → Plus Jakarta Sans + Sora display). **Seluruh redesign mobile
> fungsional lengkap di semua menu.**
>
> **Sisa = polish OPSIONAL (bukan bug, halaman sudah fungsional):**
> - Toolbar list (cari+tanggal) Pembelian/Penjualan/Pengeluaran/Stok → `FilterSheet`.
> - `rab/rab-editor.tsx` cek responsif bila dipakai intens di mobile.
> - Header mobile (sapaan+avatar, buang hamburger redundan); dialog pendek full-screen.
> - Portal distributor `/portal` (aplikasi login terpisah).
>
> **Cara melanjutkan:** jalankan dev (`npm run dev -- --webpack --port 3100`), baca
> komponen target, terapkan pola, `tsc --noEmit`, verifikasi E2E. Untuk verifikasi
> cepat tanpa login lambat: pakai `storageState:"e2e/.auth/state.json"` di context
> Playwright (sesi akun test tersimpan; gitignored). Perbarui checkbox setiap selesai.
>
> **Polish tertunda (Fase 7):** toolbar list (search+tanggal) masih memanjang di
> mobile — bisa dipindah ke `FilterSheet` seperti Transaksi; form (penjualan/
> pembelian/pengeluaran) masih dialog desktop — jadikan full-screen di mobile;
> header mobile (opsi sapaan+avatar) & hilangkan redundansi hamburger vs tab Menu.
