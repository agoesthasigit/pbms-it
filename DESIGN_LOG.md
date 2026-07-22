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
| 0 | DESIGN_LOG + branch | ✅ Selesai | — |
| 1 | Token: font, palet teal, radius | ⏳ Berjalan | — |
| 2 | Shell: kanvas, kartu, sidebar, header | ⬜ Belum | — |
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
