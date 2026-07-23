# DESIGN LOG — Refresh UI Teal

Catatan permanen pengerjaan refresh tampilan PBMS-IT. **Baca file ini dulu**
sebelum melanjutkan pekerjaan UI, supaya tahu sudah sampai fase mana.

> **⚠️ 2026-07-24 — Arah dibalik (lihat Fase 6).** Setelah di-review, tampilan
> teal ditolak; user memilih kembali ke gaya lama hitam-putih + font serif.
> Fase 6 me-*revert* rasa/warna Fase 1–4, **tetapi mempertahankan** perbaikan
> bug (font tidak lagi jadi soal karena serif memang diinginkan, ikon PWA,
> safe-area, skeleton) dan struktur 3-kartu, serta **menambah bottom nav
> mobile**. Bagian di bawah (Fase 0–5) dibiarkan sebagai catatan sejarah.

- **Branch:** `ui/teal-refresh` (dicabang dari `main` @ `4c8839e`)
- **Mulai:** 2026-07-22
- **Pendekatan:** *token-first*. Ubah variabel desain di satu tempat, biarkan
  seluruh aplikasi ikut berubah. **Tidak menyentuh query, form, database,
  maupun logika bisnis.**
- **Referensi visual:** dashboard TeamHub — kanvas abu lembut, kartu putih
  ber-shadow, sidebar icon+label, teal sebagai aksen tunggal, badge pill,
  tabel padat yang dipoles.

## Status fase

| Fase | Isi | Status | Commit |
| --- | --- | --- | --- |
| 0 | DESIGN_LOG + branch | ✅ Selesai | `c1825d8` |
| 1 | Token: font, palet teal, radius | ✅ Selesai | `ec60420` |
| 2 | Shell: kanvas, kartu, sidebar, header | ✅ Selesai | lihat di bawah |
| 3 | Tabel & badge | ✅ Selesai | `510cc24` |
| 4 | StatCard & baris stat | ✅ Selesai | `4bccc8f` |
| 5 | PWA / mobile | ✅ Selesai | lihat di bawah |
| 6 | Balik ke gaya lama + bottom nav | ✅ Selesai | lihat di bawah |

**Aturan:** satu fase = satu commit. Aplikasi harus tetap jalan di antara fase.
Kalau hasil sebuah fase tidak disukai, cukup `git revert` commit fase itu.

## Kondisi awal (baseline)

Temuan saat audit sebelum ada perubahan:

1. **Font Plus Jakarta Sans tidak pernah tampil.** `layout.tsx` memuatnya
   sebagai `--font-jakarta`, tapi `globals.css` menulis
   `--font-sans: var(--font-sans)` — variabel menunjuk ke dirinya sendiri dan
   tidak pernah didefinisikan. Akibatnya `font-sans` resolve ke kosong dan
   browser jatuh ke **serif bawaan**. Ini penyebab utama kesan "dokumen cetak".
   Bug, bukan pilihan desain.
2. **Palet 100% tanpa warna.** Semua token `:root` berbentuk `oklch(L 0 0)` —
   chroma `0`, alias abu-abu murni. Penyebab teknis kesan hambar.
3. **Niat teal sudah ada tapi terputus.** `manifest.ts` dan `viewport.themeColor`
   sudah `#0f766e` (teal-700), jadi splash screen PWA sudah teal sementara isi
   aplikasinya abu-abu.

Yang sudah benar dan sengaja **tidak** diubah:
`StatCard` sudah pakai `bg-primary/10 text-primary` (otomatis jadi chip teal),
sidebar active sudah `bg-primary`, `TableRow` sudah punya hover. Semua ikut
berubah sendiri begitu token diganti — inilah alasan pendekatan token dipilih.

## Keputusan desain

- **Teal-700 `#0f766e`** jadi `--primary`, menyambung ke `theme_color` manifest
  yang sudah ada. Dipakai terbatas: tombol primary, sidebar aktif, chip icon,
  focus ring. Tidak lebih.
- **Netral di-*tint* ke teal** (hue ~190, chroma 0.006–0.02), bukan abu murni.
  Ini yang bikin palet terasa menyatu, trik yang dipakai referensi.
- **Naik/turun tidak pakai teal.** Token `--success` (hijau) dan `--destructive`
  (merah lembut) dipisah supaya tidak bertabrakan dengan warna brand.
- **Light mode saja** untuk sekarang. Blok `.dark` dibiarkan apa adanya dan
  belum dipakai; dijadwalkan sebagai fase terpisah kalau nanti diperlukan.
- **Sidebar tetap icon + label.** Pola *icon rail* mengambang di referensi
  ditolak: menu aplikasi ini 16+ item, icon tanpa label akan menyiksa.

## Riwayat perubahan

### Fase 0 — 2026-07-22

Menyiapkan infrastruktur pencatatan. Branch `ui/teal-refresh` dibuat supaya
`main` tidak tersentuh. File ini dibuat.

Tidak ada perubahan kode.

### Fase 1 — 2026-07-22 · hanya `globals.css`

Satu file. Tidak ada komponen, halaman, query, atau logika yang disentuh.

**1. Font diperbaiki.** `--font-sans: var(--font-sans)` → `var(--font-jakarta)`
plus rantai fallback. Plus Jakarta Sans akhirnya benar-benar tampil di seluruh
aplikasi; serif bawaan browser hilang. `--font-heading` dan `--font-mono` juga
diberi fallback yang benar (`--font-geist-mono` tidak pernah dimuat proyek ini,
jadi tanpa fallback teks mono pun jatuh ke serif).

**2. Palet abu-abu → teal.** Nilai sebelum/sesudah untuk token yang paling
kelihatan:

| Token | Sebelum | Sesudah |
| --- | --- | --- |
| `--primary` | `oklch(0.205 0 0)` hitam | `oklch(0.52 0.098 184)` teal-700 |
| `--foreground` | `oklch(0.145 0 0)` | `oklch(0.215 0.021 197)` |
| `--muted-foreground` | `oklch(0.556 0 0)` | `oklch(0.522 0.019 197)` |
| `--accent` | `oklch(0.97 0 0)` | `oklch(0.952 0.021 187)` |
| `--border` | `oklch(0.922 0 0)` | `oklch(0.915 0.008 192)` |
| `--ring` | `oklch(0.708 0 0)` abu | `oklch(0.52 0.098 184)` teal |
| `--chart-1..5` | 5 tingkat abu | teal → hijau → amber |

Angka tengah pada `oklch()` adalah **chroma**; sebelumnya `0` di semua token,
itulah penyebab teknis kesan hambar.

**3. Token baru:** `--canvas` (kanvas halaman di bawah kartu), `--success` /
`--warning` (dipisah dari teal supaya indikator naik-turun tidak bentrok dengan
brand), `--shadow-card` / `--shadow-card-hover` (shadow di-tint teal, bukan
hitam). Semua didaftarkan di `@theme inline` sehingga tersedia sebagai utility
`bg-canvas`, `text-success`, `shadow-card`, dst.

**4. Radius** `0.625rem` → `0.75rem`. Satu knob ini menggerakkan seluruh skala
(`--radius-xl` yang dipakai `Card` ikut naik ~10px → ~17px).

**Efek beruntun yang didapat gratis** (tanpa menyentuh file-nya): chip icon
`StatCard` jadi teal, sidebar aktif jadi teal, focus ring jadi teal, grafik
Recharts berwarna.

Verifikasi: `npm run build` sukses, 33 route terkompilasi.

### Fase 2 — 2026-07-22 · shell aplikasi

Empat file, semuanya presentasi murni. Tidak ada query, form, atau logika.

| File | Perubahan | Alasan |
| --- | --- | --- |
| `src/app/(app)/layout.tsx` | `bg-muted/30` → `bg-canvas` | Kanvas abu lembut supaya kartu putih terlihat mengambang. Sebelumnya putih di atas putih — ciri khas admin panel. |
| `src/components/ui/card.tsx` | `ring-1 ring-foreground/10` → `shadow-card ring-1 ring-border/60` | Kartu didefinisikan oleh shadow, bukan garis. Garis abu bikin kaku. |
| `src/components/shared/sidebar-nav.tsx` | hover `bg-muted` → `bg-accent`; active `shadow-sm` → `shadow-card` | Hover ikut ber-tint teal supaya sidebar terasa satu keluarga. |
| `src/components/shared/app-header.tsx` | `UserCircle2` → avatar bulat berisi inisial email, chip `bg-primary/10 text-primary` | Icon generik diganti identitas. Sekaligus menghapus import yang jadi tak terpakai. |

`brand.tsx` sengaja **tidak** disentuh — sudah memakai `bg-primary`, jadi
logonya berubah jadi teal dengan sendirinya.

Ditambahkan juga `.claude/launch.json` supaya `npm run dev` bisa dijalankan
lewat tooling preview.

**Verifikasi:**

- `npm run build` sukses, 27 halaman statis ter-generate.
- `npx eslint` pada empat file yang diubah: **0 masalah**.
  (Catatan: `npm run lint` seluruh proyek melaporkan 122 masalah — 33 error,
  89 warning — semuanya **sudah ada sebelumnya** di file lain seperti
  `global-search.tsx`, tidak berhubungan dengan pekerjaan UI ini.)
- Computed style dicek langsung di browser pada `http://localhost:3000`:

  | Properti | Hasil |
  | --- | --- |
  | `body` font-family | `"Plus Jakarta Sans", …, ui-sans-serif` ✅ (sebelumnya kosong → serif) |
  | `--primary` | `lab(45.5% -34.1 -2.8)` ✅ teal (sebelumnya `a=0, b=0` abu murni) |
  | `--radius` | `.75rem` ✅ |
  | `--success` | `lab(55.3% -43.1 20.0)` ✅ hijau, terpisah dari teal |

### Fase 3 — 2026-07-22 · tabel & badge

**Temuan:** ada **25+ badge dengan warna Tailwind hardcoded**
(`bg-emerald-100`, `bg-red-100`, `bg-amber-100`, `bg-sky-100`, `bg-slate-100`)
yang melewati sistem token. Inilah sumber inkonsistensi warna yang sebenarnya —
mengganti `--primary` tidak akan pernah menyentuh badge-badge ini.

**`table.tsx`** (menjangkau 15 file yang memakainya):

| Bagian | Sebelum | Sesudah | Alasan |
| --- | --- | --- | --- |
| `Table` | — | `tabular-nums` | Digit jadi sama lebar, kolom rupiah rata sempurna. |
| `TableHeader` | polos | `bg-muted/40` | Header terpisah jelas dari isi. |
| `TableHead` | `h-10 px-2 text-foreground` | `h-11 px-4 text-xs uppercase tracking-wide text-muted-foreground` | Header jadi label tenang, bukan bersaing dengan data. |
| `TableCell` | `p-2` | `px-4 py-3` | Baris bernapas; kerapatan referensi. |
| `TableRow` | `border-b hover:bg-muted/50` | `border-b border-border/60 hover:bg-accent/40` | Garis lebih lembut, hover ber-tint teal. |

**`badge.tsx`** — tiga varian baru: `success`, `warning`, `danger`.

**Token baru** (`globals.css`): pasangan `--*-tint` (latar) dan `--*-strong`
(teks) untuk success/warning/destructive. Dipisah karena `--success` saja
(`L=0.6`) terlalu terang untuk teks kecil di atas latar terang — kontrasnya
tidak memadai. Pasangan tint+strong memberi rasio ~5:1.

**Migrasi ke token** — semua badge status kini tunable dari `globals.css`:

| Status | Sebelum | Sesudah |
| --- | --- | --- |
| draft | `bg-slate-100 text-slate-700` | `bg-muted text-muted-foreground` |
| sent / ongoing | `bg-sky-100 text-sky-700` | `bg-primary/10 text-primary` |
| paid / done / active / aktif | `bg-emerald-100 text-emerald-700` | `bg-success-tint text-success-strong` |
| expiring / jatuh tempo | `bg-amber-100 text-amber-700` | `bg-warning-tint text-warning-strong` |
| overdue / expired | `bg-red-100 text-red-700` | `bg-destructive-tint text-destructive-strong` |

`sent`/`ongoing` sengaja dipetakan ke **primary (teal)**, bukan biru: status
"sedang berjalan" adalah keadaan aktif, cocok memakai warna brand.

File tersentuh: `table.tsx`, `badge.tsx`, `globals.css`, `types/phase5.ts`,
`types/phase7.ts`, dan 7 file halaman (hanya string className, tanpa logika).

**Verifikasi:** `npx tsc --noEmit` bersih; `npm run build` sukses; eslint pada
file yang diubah 0 error. Sisa badge hardcoded: **0**.
(Satu warning `formatDate is defined but never used` di `client-manager.tsx`
sudah dikonfirmasi **pre-existing** lewat `git stash` — bukan dari perubahan ini.)

### Fase 4 — 2026-07-22 · StatCard & baris stat

**Akar masalah ruang kosong ditemukan.** Keluhan awal user — kartu "Total
Pembelian" berdiri sendirian menyisakan ~60% layar kosong — disebabkan satu
class: `sm:max-w-md` pada pembungkus grid, yang mengunci kartu di ~450px.
Ada di dua tempat: `purchases/purchase-list.tsx` dan `sales/sale-list.tsx`.

Diganti `lg:grid-cols-3` dan diisi dua `StatCard` pendamping:

| Halaman | Kartu 1 (sudah ada) | Kartu 2 (baru) | Kartu 3 (baru) |
| --- | --- | --- | --- |
| Pembelian | Total Pembelian | Jumlah Nota + unit barang | Rata-rata per Nota |
| Penjualan | Total Penjualan | Jumlah Transaksi + client berbeda | Rata-rata per Transaksi |

Semua angka **diturunkan dari array `filtered` yang sudah ada** dan ikut filter
tanggal/pencarian. **Tidak ada query, RPC, atau perhitungan bisnis baru** —
murni agregasi tampilan (`length`, `reduce`, `Set`).

**`stat-card.tsx`:** `tabular-nums`, `truncate` + `min-w-0` supaya nominal
panjang tidak mendorong chip icon, chip jadi `rounded-xl`, hover
`shadow-card-hover`.

**`summary-card.tsx`:** chip icon `bg-amber-50 text-amber-500 ring-amber-100`
→ `bg-primary/10 text-primary` (amber nyasar yang bikin palet terasa acak);
indikator naik/turun `text-emerald-600`/`text-red-600` → token
`text-success-strong`/`text-destructive-strong`; nominal `tabular-nums`.

**Migrasi warna aksen** di 9 file: `text-emerald-600` → `text-success-strong`,
`text-amber-600` → `text-warning-strong`, `text-red-600` →
`text-destructive-strong`, `text-sky-600` → `text-primary`. Sisa: **0**.

**Verifikasi:** `tsc --noEmit` bersih, `npm run build` sukses, eslint 0 masalah
pada file yang diubah. Token dicek resolve di browser, dan kontras teks badge
dihitung dari nilai L\*: **5.5–6.0:1**, di atas ambang WCAG AA (4.5:1).

### Fase 5 — 2026-07-22 · PWA & mobile

**🔴 Bug PWA ditemukan: seluruh ikon 404.** `manifest.ts` menunjuk ke
`/icons/icon-192.png` dan kawan-kawan, padahal file ikon ada di **`public/`
(root)**, bukan `public/icons/`. Direktori `public/icons/` tidak pernah ada.
Akibatnya PWA selalu terpasang dengan ikon default browser — inilah sebab
utama keluhan "tampilan PWA tidak bagus". Bug ini sudah ada sejak awal, bukan
akibat pekerjaan refresh ini.

Diverifikasi lewat `fetch` di browser sebelum & sesudah:

| Path | Sebelum | Sesudah |
| --- | --- | --- |
| `/icons/icon-192.png` | **404** | — (tidak dipakai lagi) |
| `/icon-192.png` | — | **200** |
| `/icon-512.png` | — | **200** |
| `/icon-maskable-512.png` | — | **200** |

Perubahan lain:

- **`layout.tsx`** — `viewportFit: "cover"`. Tanpa ini `env(safe-area-inset-*)`
  selalu bernilai `0` di iPhone bernotch, jadi seluruh penanganan safe-area
  tidak akan berefek.
- **`(app)/layout.tsx`** — padding `main` mengikuti
  `max(1rem, env(safe-area-inset-*))` di bawah/kiri/kanan.
- **`app-header.tsx`** — `pt-[env(safe-area-inset-top)]`, dan `h-14` diganti
  **`min-h-14`**: tinggi tetap + padding-top akan menggencet isi header karena
  `box-sizing: border-box`.
- **`manifest.ts`** — tambah `id`, `scope`, `lang`, `dir`, `categories`;
  `background_color` `#ffffff` → `#f4f7f6` disamakan dengan `--canvas` supaya
  splash screen tidak "berkedip" putih saat app dibuka.
- **`(app)/loading.tsx`** (baru) — kerangka skeleton bersama untuk semua route
  grup `(app)`, bentuknya meniru susunan halaman umum (judul → 3 kartu →
  tabel) supaya transisi tidak melompat. Sebelumnya buka app = layar kosong.
- **`table.tsx`** — padding sel responsif `px-3 py-2.5` → `sm:px-4 sm:py-3`,
  supaya tabel tidak terlalu boros ruang di layar HP.

**Verifikasi:** `tsc --noEmit` bersih, `npm run build` sukses, eslint 0 masalah.
Keempat `safe-area-inset-*` dikonfirmasi benar-benar ter-generate di CSS hasil
build (arbitrary value Tailwind bisa diam-diam tidak ter-generate kalau salah
tulis). Manifest hasil render dicek via HTTP. Console browser: 0 error.

### Fase 6 — 2026-07-24 · balik ke gaya lama + bottom nav

**Keputusan user setelah review:** tampilan teal "terlalu ramai"; yang lama
(hitam-putih, font serif, kartu datar) dinilai lebih enak — terutama font serif
yang lebih rapat sehingga screenshot lebih mudah dibaca. Tapi **bukan** revert
total: perbaikan bug dan satu penambahan struktural tetap dipertahankan.

**Dibalik ke `main` (rasa/warna Fase 1–4):**

- `globals.css` di-*checkout* utuh dari `main` → palet abu/hitam-putih (chroma 0),
  font serif kembali (`--font-sans` menunjuk ke dirinya sendiri lagi — dulu
  dianggap bug, sekarang justru yang diinginkan), radius kecil `.625rem`. Ini
  saklar utama: StatCard, sidebar aktif, focus ring otomatis ikut mono.
- Komponen presentasi di-*checkout* dari `main`: `card.tsx` (garis tipis, tanpa
  shadow), `sidebar-nav.tsx`, `stat-card.tsx`, `summary-card.tsx`, `table.tsx`,
  `badge.tsx`.
- **Badge status kembali berwarna** (pilihan user): `types/phase5.ts`,
  `types/phase7.ts`, dan ~13 file halaman (clients, dashboard, invoices, rab,
  reports, maintenance, dll) di-*checkout* dari `main` → emerald/red/amber/sky
  hardcoded balik seperti semula. Satu badge inline "Lunas" di `sale-list.tsx`
  di-edit tangan (`bg-success-tint` → `bg-emerald-100`).
- `app-header.tsx` — avatar inisial dikembalikan ke ikon `UserCircle2`.
- `(app)/layout.tsx` — `bg-canvas` → `bg-muted/30`.
- `manifest.ts` — `background_color` `#f4f7f6` → `#ffffff` (splash putih lagi).

**Dipertahankan (perbaikan bug & struktur, sengaja TIDAK dibalik):**

- Ikon PWA (`manifest.ts` path `/icon-*.png`) + metadata `id/scope/lang/categories`.
- `viewportFit: "cover"` (`layout.tsx` root) + safe-area di `(app)/layout.tsx`
  (padding samping) & `app-header.tsx` (`min-h-14` + `pt-[env(safe-area-inset-top)]`).
- `(app)/loading.tsx` skeleton.
- **Isi 3 kartu** di `purchase-list.tsx` & `sale-list.tsx` — struktur `lg:grid-cols-3`
  + StatCard pendamping tetap; warnanya jadi mono otomatis lewat token.

**Baru — bottom navigation mobile** (`components/shared/bottom-nav.tsx`):
bar tetap di bawah, **hanya tampil di mobile** (`lg:hidden`, di desktop ada
sidebar). 4 menu tersering: **Pembelian** (`/purchases`), **Penjualan**
(`/sales`), **Operasional** (`/expenses/operational`), **Laporan** (`/reports`)
— rute & ikon disamakan dengan `nav-links.ts`. Menu lengkap tetap lewat
hamburger + sheet. `(app)/layout.tsx`: `<BottomNav />` dipasang + padding bawah
`main` jadi `pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-8` supaya
konten tidak tertutup bar (di-reset di lg).

**Catatan:** `theme_color` PWA dibiarkan teal `#0f766e` — nilai ini sudah ada di
`main` sebelum refresh (bukan hasil Fase 1–5), jadi "kembali seperti semula"
berarti tetap teal. Mudah dinetralkan nanti kalau strip status bar teal terasa
mengganggu di PWA.

**Verifikasi:** `tsc --noEmit` bersih; `npm run build` sukses (27 route);
computed style di browser pada `/login` dikonfirmasi — font `Times New Roman`
(serif), `--primary` `lab(7.8% ~0 0)` (hitam, chroma ~0), `--radius` `.625rem`,
token `--canvas` hilang. Halaman terautentikasi belum dicek visual karena
preview tak punya sesi login; perlu dikonfirmasi user di browser yang login,
khususnya bottom nav di layar HP.

## ⏭️ Lanjutan berikutnya

Fase 0–5 **selesai**. Yang sengaja **belum** dikerjakan, berikut alasannya:

1. **Tabel → daftar kartu di layar HP.** Ini perubahan struktural di 15 file
   dan berisiko jauh lebih tinggi daripada seluruh Fase 1–5 digabung. Saat ini
   tabel di HP masih di-scroll horizontal. Layak dikerjakan sebagai fase
   tersendiri, mulai dari halaman yang paling sering dibuka di HP saja.
2. **Bottom navigation di mobile.** Saat ini masih hamburger + sheet. Perlu
   memilih 4–5 menu utama dari 16+ item — itu keputusan produk, bukan desain.
3. **Date range picker custom.** Dua `<input type="date">` native masih
   menampilkan format US `MM/DD/YYYY` padahal aplikasinya berbahasa Indonesia.
   Ini bug UX nyata dan pekerjaannya sedang, bukan berat.
4. **Banner berwarna hardcoded.** Masih ada `bg-sky-50`, `bg-amber-50`,
   `bg-emerald-50` di `products/product-manager.tsx`, `invoices/page.tsx`,
   `assets/asset-manager.tsx`, `rab/rab-editor.tsx`. **Semua badge dan warna
   aksen sudah token**, tapi blok banner belum. Risiko rendah, tinggal
   diteruskan pola yang sama.
5. **Dark mode.** Blok `.dark` masih palet abu-abu bawaan dan tidak dipakai.
6. **Lint pre-existing.** `npm run lint` melaporkan 122 masalah (33 error,
   89 warning) di file yang tidak berhubungan dengan UI — mis.
   `set-state-in-effect` di `global-search.tsx`. Sudah ada sebelum pekerjaan
   ini dan sengaja tidak disentuh.
