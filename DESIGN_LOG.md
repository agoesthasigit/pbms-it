# DESIGN LOG — Refresh UI Teal

Catatan permanen pengerjaan refresh tampilan PBMS-IT. **Baca file ini dulu**
sebelum melanjutkan pekerjaan UI, supaya tahu sudah sampai fase mana.

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
| 3 | Tabel & badge | ✅ Selesai | lihat di bawah |
| 4 | StatCard & baris stat | ⏳ Berjalan | — |
| 5 | PWA / mobile | ⬜ Belum | — |

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

## ⏭️ Lanjutan berikutnya

**Fase 2 sudah selesai dan menunggu review user.** Jangan mulai Fase 3 sebelum
user melihat hasilnya dan menyetujui arah warnanya.

Kalau disetujui, kerjakan berurutan:

- **Fase 3 — tabel & badge.** `table.tsx`: zebra baris, `font-variant-numeric:
  tabular-nums` untuk kolom angka, header lebih tenang. `badge.tsx`: tambah
  varian `success`/`warning` yang memakai token dari Fase 1.
- **Fase 4 — StatCard & baris stat.** `stat-card.tsx` dipoles, lalu isi ruang
  kosong di kanan kartu "Total Pembelian" pada `purchases`, `sales`,
  `dashboard`, `reports` dengan 3–4 kartu.
- **Fase 5 — PWA/mobile.** `safe-area-inset`, skeleton loading, dan tabel
  berubah jadi daftar kartu di layar kecil.

Hal yang sengaja belum dikerjakan dan bisa diangkat kapan saja: date range
picker custom (mengganti dua `<input type="date">` native yang saat ini
menampilkan format US `MM/DD` padahal aplikasinya berbahasa Indonesia).
