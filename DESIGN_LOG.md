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
| 3 | Tabel & badge | ⛔ Ditahan — tunggu review Fase 2 | — |
| 4 | StatCard & baris stat | ⛔ Ditahan — tunggu review Fase 2 | — |
| 5 | PWA / mobile | ⛔ Ditahan — tunggu review Fase 2 | — |

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
