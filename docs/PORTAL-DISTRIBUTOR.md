# Portal Distributor — Rencana & Aturan (PBMS-IT)

> Dokumen hidup. **Portal pertama:** _Line Art by Cino_ (pemasok banner/kertas/ATK,
> selalu beli-tempo, dibayar akhir bulan). Dokumen ini sekaligus jadi **pola yang bisa
> dipakai ulang** bila kelak ada portal distributor lain (perkiraan pemilik: mungkin ~3
> distributor beberapa tahun lagi). **Setiap revisi aturan portal WAJIB dicatat di sini**
> (lihat bagian "Log Revisi Aturan" di bawah).
>
> Status: **DALAM PENGERJAAN** (mulai 2026-08-22). Lihat "Papan Progres".

---

## 0. Jangan tertukar nama

- **Pemasok "Line Art by Cino"** = baris di tabel `distributors`. Portal ini untuknya.
  (Dulu di catatan lama disebut "Cetak Ide".)
- **Brand jualan "Cetak Ide"** (`sales.brand='cetak_ide'`, seri `CTK/...`) = identitas
  PEMILIK saat menagih client. **Bukan pemasok.** Kebetulan mirip nama — jangan dicampur.

---

## 1. Masalah bisnis yang diselesaikan

Pemilik mengambil barang dari Line Art untuk dikirim **langsung ke lokasi client**
(mis. Rob Peetoom Seminyak, Letter Design). Sekarang pemesanan lewat WhatsApp; akhir bulan
Line Art menagih. Portal membuat **Line Art menginput sendiri** apa yang dia kirim (hanya
**harga modal**), lalu pemilik **me-review**, menambah **harga jual**, dan menjualnya ke
client via **invoice bulanan** — semua di dalam PBMS, rapi dan berjejak.

---

## 2. Prinsip inti (JANGAN dilanggar — ini yang menjaga sistem tak error)

1. **Satu entri portal = satu PEMBELIAN (nota), bukan penjualan.** Entri mewakili "apa
   yang Line Art kirim & tagih ke pemilik" (sisi hutang), bukan "apa yang pemilik jual ke
   client" (sisi invoice).

2. **Dua aliran uang terpisah, tak saling mengunci:**
   - **Aliran 1 — Pemilik ↔ Line Art** (hutang/_payable_). Lunas saat **pemilik bayar Line
     Art**. **Inilah satu-satunya jangkar kunci portal.**
   - **Aliran 2 — Client ↔ Pemilik** (piutang/invoice bulanan). Lunas saat **client bayar**.
   - **Portal HANYA menonton Aliran 1.** Status invoice client (termasuk fitur **Batal
     Lunas**) **tidak pernah** memengaruhi portal. Ini yang menyembuhkan kekhawatiran
     "batal lunas": karena portal memang tak melihat Aliran 2.

3. **Model staging + tombol "Terima".** Line Art menulis ke **meja antara**
   (`distributor_orders`), **bukan** langsung ke buku keuangan. Barang baru masuk stok &
   jadi hutang **setelah pemilik klik "Terima"**. Draft = di luar buku → edit/hapus draft
   berdampak **nol** (sejalan prinsip "edit baris invoice belum lunas = nol dampak kas").

4. **"Terima" selalu dijalankan di sesi PEMILIK.** RPC keuangan lama (`create_purchase`,
   dst.) memakai `auth.uid()`. Dengan "Terima" diklik pemilik, `auth.uid()` = pemilik →
   RPC lama **tak perlu diubah**. Distributor **tidak pernah** memanggil RPC keuangan.

5. **Distributor tembok-terisolasi.** Akun distributor **tidak** diberi grant baca/tulis
   ke tabel mana pun kecuali lewat **RPC portal khusus** yang menyaring ketat "hanya
   miliknya". Wallet, client, laba, invoice, harga jual → **tak terjangkau**. Karena RLS
   semua tabel inti = `user_id = auth.uid()` dan uid distributor tak memiliki baris di
   sana, tembok privasi sudah berdiri dari default; portal cuma menambah pintu sempit.

6. **Harga jual milik pemilik.** Diisi saat "Terima". Line Art **tak pernah** melihatnya.

7. **Nota tidak digabung.** Beda pengiriman = beda tanggal = beda nota (tanggal jujur).
   Penggabungan terjadi di tempat yang benar: **invoice bulanan client** (banyak penjualan
   → satu invoice) dan **pembayaran hutang** (banyak nota → satu bukti/email).

8. **Tujuan = teks bebas** (privasi client). Line Art mengetik tujuan (mis. "Rob Peetoom
   Seminyak"); **tidak** memilih dari daftar client pemilik. Saat "Terima", tujuan
   **disalin & digabung** ke `purchases.notes` (`Tujuan: X | <catatan pemilik>`), sehingga
   muncul di menu Pembelian & Hutang tanpa layar baru, dan **tampil di bukti pelunasan**.

---

## 3. Siklus hidup entri (state machine)

```
        Line Art input
             │
             ▼
        ┌─────────┐   Line Art: edit / hapus BEBAS
        │  DRAFT  │◄──────────────────────────────┐
        └────┬────┘                                │
   pemilik "Terima" (isi harga jual)               │ pemilik "Batal Terima"
             │  → create_purchase(is_credit=true)  │  (syarat: BELUM ada unit terjual
             ▼     stok masuk + hutang tercatat    │   DAN hutang BELUM dibayar)
        ┌──────────┐                                │
        │ DITERIMA │  Line Art: READ-ONLY ──────────┘
        └────┬─────┘
   pemilik bayar hutang (pay_purchases)
             │
             ▼
        ┌────────┐
        │ LUNAS  │  Line Art: READ-ONLY, pindah ke tab "Arsip/Riwayat"
        └────────┘

  (Ada juga DITOLAK: pemilik menolak draft mentah tanpa memprosesnya.)
```

Perpindahan status **tak pernah** dipicu invoice client. Hanya oleh aksi pemilik di sisi
pembelian/hutang.

### Aturan hapus/koreksi (menghormati guard yang sudah ada)
- **Hapus di sisi jual** (`delete_invoice_item` pada invoice belum lunas) → stok balik,
  **pembelian & hutang & portal TIDAK berubah**. Benar: pemilik tetap menerima & berhutang
  barang itu ke Line Art terlepas client jadi beli atau tidak.
- **Hapus pembelian** (`delete_purchase`) sudah di-guard (audit 5.4): **ditolak** bila
  sebagian sudah terjual. Portal menambah syarat: **ditolak bila hutang sudah dibayar**.
  Bila lolos → entri portal kembali ke **DRAFT** (Line Art bisa perbaiki & ajukan ulang).

---

## 4. Model data (rencana Phase 0)

Tiga objek baru (nama final bisa disesuaikan saat implementasi):

- **`distributor_accounts`** — "kartu identitas" login portal.
  `auth_uid` (PK, ref `auth.users`), `distributor_id` (ref `distributors`),
  `owner_user_id` (uid pemilik pemilik data), `is_active`, `created_at`.
  Di-*seed* sekali per distributor (manual/migrasi). **Tak butuh Service Role Key.**

- **`distributor_orders`** — meja antara (pengajuan).
  `id`, `owner_user_id`, `distributor_id`, `submitted_by` (uid distributor),
  `destination` (teks bebas tujuan), `status` (`draft`/`accepted`/`rejected`),
  `purchase_id` (ref `purchases`, terisi saat Terima), `notes`, `created_at`, `updated_at`.

- **`distributor_order_items`** — baris barang pengajuan.
  `id`, `order_id`, `name`, `qty`, `cost_price`. (Harga jual **tidak** di sini.)

**Yang di-reuse tanpa diubah:** `create_purchase(is_credit=true, due_date)`, `pay_purchases`,
tab Hutang (`/piutang`), `dashboard_counts.total_payable`, bukti PDF + email
`sendHutangPaymentEmail`, seluruh alur stok/HPP/invoice/laporan.

---

## 5. Login & peran (Opsi A — Supabase Auth, dikelola manual di dashboard)

- Distributor = **user Supabase Auth betulan** (email+password), **dibuat manual di dashboard
  Supabase** (Authentication → Add user). Reset password juga via dashboard. Konsekuensi
  diterima pemilik: kelola kredensial di dashboard, **bukan** di UI PBMS → **tanpa**
  `SUPABASE_SERVICE_ROLE_KEY`, app tetap pakai anon key seperti sekarang.
- **Deteksi peran saat login:** cek uid di `distributor_accounts`. Ada → arahkan ke
  **`/portal`** (layout terbatas, hanya menu pengajuan). Tidak ada → PBMS penuh.
- **Penjaga rute:** middleware + layout memastikan uid distributor tak bisa membuka rute
  `(app)/*` pemilik, dan sebaliknya pemilik tak "nyasar" ke `/portal`.

---

## 6. Fase & Checkpoint

Setiap fase punya **checkpoint** (kondisi "selesai & bisa dilanjut"). Centang saat tuntas.

### Phase 0 — Fondasi DB & keamanan  ✅ SELESAI (2026-08-22)
- [x] Migrasi `20260822_distributor_portal_phase0.sql`: `distributor_accounts`,
      `distributor_orders`, `distributor_order_items` + RLS (akses langsung hanya pemilik).
- [x] RPC portal (sisi distributor, `SECURITY DEFINER`, scoped ke uid-nya):
      `portal_my_context()`, `portal_list_orders(search?)`, `portal_upsert_order(...)`,
      `portal_delete_order(id)`. Menolak bila uid bukan distributor aktif / bukan pemilik
      entri / entri bukan `draft`.
- [x] RPC pemilik: `accept_distributor_order(order_id, p_lines[], notes?)`
      → `create_purchase(is_credit=true, due_date=akhir bulan)`, salin+gabung tujuan ke
      `purchases.notes`, set `status='accepted'` + `purchase_id`.
      `unaccept_distributor_order(order_id)` (Batal Terima; guard `delete_purchase` + hutang
      belum dibayar) → kembali `draft`. `reject_distributor_order(order_id)`.
- [x] `data_integrity_report` +F1 (migrasi `20260822_distributor_portal_datacheck.sql`) —
      "pengajuan diterima tanpa pembelian valid" (kini 23 cek).
- [x] **SEED:** akun portal Line Art (uid `c3d36c0a-…` / rizkyyunuskurniawan@gmail.com) →
      distributor `21f1cfb9-…` (Line Art by CINO) → owner `47e880a0-…`.
- [x] **Checkpoint:** kedua migrasi diterapkan ke prod; smoke test transaksi-rollback **11/11
      lulus** (accept→purchase 230000, is_credit, notes "Tujuan: Rob Peetoom Seminyak",
      stok_in 11; unaccept→balik draft, pembelian terhapus, stok net-0). Belum ada UI.
- **Catatan:** `pg` ternyata hilang dari `node_modules`/`package.json` (pola korupsi mesin) →
      `backup.mjs`/`apply-migration.mjs` sempat rusak; dipasang ulang `npm i -D pg`.

### Phase 1 — Deteksi peran & routing login  ✅ SELESAI (2026-08-22)
- [x] Helper `src/lib/portal/context.ts` → `getPortalContext()` (panggil RPC
      `portal_my_context`; distributor→objek, pemilik→null).
- [x] `(app)/layout.tsx`: bila `getPortalContext()` ada → `redirect('/portal')`.
- [x] Rute baru `/portal` (di luar grup `(app)`): `portal/layout.tsx` (guard: bukan
      distributor → `redirect('/dashboard')`; header "Portal Distributor" + nama + Keluar)
      & `portal/page.tsx` (sapaan + placeholder; UI asli di Phase 2).
- [x] **Checkpoint:** `tsc` bersih. Verifikasi browser: `/portal` tanpa login → `/login`;
      owner login → `/dashboard` (tak terlempar); owner buka `/portal` → `/dashboard`.
      Jalur distributor→`/portal` terbukti di lapisan SQL (`portal_my_context` = "Line Art
      by CINO"); login browser sbg distributor menunggu password Line Art (di dashboard).
- **Env fix:** `.claude/launch.json` +`env NODE_OPTIONS=--use-system-ca` — server dev tak
      memercayai root CA proxy mesin (TLS `UNABLE_TO_VERIFY_LEAF_SIGNATURE`) → semua auth
      Supabase gagal; `--use-system-ca` (Node 24) memercayai CA sistem (bukan menonaktifkan
      verifikasi). Tanpa ini login/E2E lokal gagal saat proxy TLS aktif.

### Phase 2 — Portal (sisi Line Art)  ✅ SELESAI (2026-08-22)
- [x] `portal/actions.ts` (server actions `upsertOrder`/`deleteOrder` → RPC portal),
      `portal/portal-client.tsx` (UI), `portal/page.tsx` (fetch `portal_list_orders`),
      `portal/layout.tsx` +`ConfirmProvider`.
- [x] Daftar pengajuan (kartu expand rincian) + **search** (tujuan & nama barang) + total
      aktif; badge status Draft/Diterima(biru)/Lunas(hijau)/Ditolak; tab **Aktif/Arsip**.
- [x] Dialog buat/ubah/hapus **draft** (tanggal kirim + tujuan teks bebas + baris barang
      nama/qty/modal via `CurrencyInput`; hapus via `useConfirm`). Read-only utk non-draft.
- [x] **Checkpoint (verifikasi browser live, akun e2e dipetakan sementara sbg distributor
      lalu dibersihkan):** routing `/dashboard`→`/portal`; buat draft "Rob Peetoom Seminyak"
      10×3.000=Rp30.000 (persisted); search "banner"→kosong, "kertas"→cocok; hapus+konfirmasi
      (DB draft=0). `tsc` bersih.
- **Catatan artefak:** animasi keluar dialog membeku saat pane browser tak dikompositkan
      (verifikasi headless) — `data-closed` sudah benar (state menutup), unmount visual saja
      yang menunggu frame; di browser nyata menutup normal. Bukan bug kode.

### Phase 3 — Admin: Pengajuan Masuk + Terima/Batal + notifikasi  ✅ SELESAI (2026-08-22)
- [x] Layar `/distributor-orders` (`(app)/distributor-orders/{page,orders-client,actions}.tsx`):
      tab **Menunggu/Diterima** (+count), kartu expand rincian, tujuan menonjol.
- [x] Dialog **Terima** (harga jual + garansi per baris, kalkulasi modal/jual/laba live) →
      `accept_distributor_order`. **Batal Terima** (`unaccept_`) & **Tolak** (`reject_`).
- [x] **Badge notifikasi** jumlah pengajuan `draft` di menu (nav-links +item "Pengajuan Masuk"
      grup Transaksi; `SidebarNav`/`AppHeader` +prop `badges`; `(app)/layout.tsx` hitung
      `distributor_orders` status=draft). Menyegar saat buka/pindah halaman (bukan realtime);
      email-ke-pemilik **tidak** dipakai (keputusan pemilik).
- [x] **Checkpoint (verifikasi browser live, order uji utk owner e2e, lalu dibersihkan):**
      badge "Pengajuan Masuk 1"; Terima 2 barang (jual 400rb, laba 170rb) → pembelian hutang
      Rp230.000 (jatuh tempo akhir bulan) + stok masuk + notes "Tujuan: TEST Seminyak"; Batal
      Terima → pembelian terhapus, stok net-0, order balik draft; Tolak → status rejected.
- **Bug ditemukan & diperbaiki saat verifikasi:** `onReject`/`onUnaccept` semula memanggil
      `confirm()` **di dalam** `startTransition` → dialog konfirmasi tak muncul. Dibetulkan:
      `await confirm()` dulu (di luar transition), aksi di dalam `startTransition` (pola sama
      `portal-client`). `tsc` bersih.

### Phase 4 — Bukti pelunasan diperkaya + E2E  ✅ SELESAI (2026-08-22)
- [x] Bukti PDF pelunasan: **tujuan per nota** — `build-hutang-payment-pdf.ts` select `notes`
      + ekstrak `Tujuan: X` (regex), `hutang-payment-pdf.tsx` render sub-baris muted di sel
      No. Nota (hanya bila ada tujuan; nota non-portal tak terganggu). Kode-verified (`tsc`).
- [x] E2E: `/distributor-orders` ditambah ke ROUTES smoke; test guard "pemilik tak bisa buka
      `/portal`" (→ `/dashboard`). `playwright.config.ts` webServer +`env NODE_OPTIONS=
      --use-system-ca` (agar login E2E tak gagal saat proxy TLS aktif).
- [x] **Checkpoint:** `npm run test:e2e` **27/27 lulus** (2.4 mnt) — incl. `/distributor-orders`
      render, guard peran, & "Data sehat" (tabel/RPC baru tak bikin anomali). Tanpa regresi.
- **Catatan:** verifikasi render PDF penuh (tujuan tampil di kertas) menunggu ada nota hutang
      portal yang benar-benar dilunasi; perubahannya kecil & aditif.

### Phase 5 — Audit menyeluruh  ✅ SELESAI (2026-08-22)
- [x] Uji **negatif-eksplisit** (skrip: role `authenticated` + JWT distributor, transaksi
      rollback) — **23/23 lulus**:
      - RLS aktif di 3 tabel baru; distributor baca **0 baris** dari wallets, wallet_transactions,
        clients, sales, sale_items, **products** (harga jual), purchases, monthly_invoices,
        client_assets (lewat RLS) — dan **0** dari `distributor_orders/_accounts` langsung
        (owner-only; RPC portal SECURITY DEFINER yang menyaring).
      - distributor **tak bisa** `accept_/reject_distributor_order` (owner-scoped) & **tak bisa**
        INSERT `distributor_orders` atas nama owner (RLS `with check`).
      - `anon` baca `distributor_orders` = 0; owner (bukan distributor) ditolak `portal_list_orders`.
      - Cross-check positif: owner **melihat** pengajuan yang dibuat distributor.
- [x] **TEMUAN & DITUTUP:** `anon` masih ber-EXECUTE ke 7 RPC portal (default `CREATE FUNCTION`
      grant ke PUBLIC; `revoke from anon` Phase 0 tak cukup). Dampak aktual nihil (semua discope
      `auth.uid()` null utk anon) tapi higiene → migrasi `20260822_distributor_portal_revoke_public.sql`
      **revoke dari PUBLIC & anon**, sisakan authenticated. Re-audit **23/23, 0 gagal**.
- [x] `purchases.notes` hanya memuat "Tujuan: … | catatan pemilik" — tak ada data sensitif;
      distributor pun tak bisa baca tabel purchases sama sekali.
- [x] **Checkpoint:** audit lulus penuh, temuan ditutup. **FITUR PORTAL DISTRIBUTOR SELESAI.**

---

## 7. Pola dipakai-ulang untuk portal berikutnya

Bila menambah distributor portal baru, ulangi hanya ini (inti tak berubah):
1. Buat user Auth-nya di dashboard Supabase.
2. Tambah 1 baris `distributor_accounts` (uid → distributor → pemilik).
3. Selesai — semua RPC/portal/aturan di atas berlaku otomatis. **Tak ada tabel/RPC baru**
   untuk distributor tambahan; portal sudah multi-distributor by design (disaring per uid).

---

## 8. Log Revisi Aturan (WAJIB diperbarui tiap ada perubahan)

- **2026-08-22 — v1 (rencana disepakati).** Semua keputusan di dokumen ini hasil diskusi
  pemilik: staging+Terima; Supabase Auth manual (tanpa service role); jangkar kunci =
  pelunasan hutang (lepas dari invoice client); harga jual milik pemilik; tujuan teks bebas
  → notes (digabung) + bukti pelunasan; nota tak digabung; badge notifikasi in-app (tanpa
  email ke pemilik). Audit menyeluruh setelah jadi.

---

## Papan Progres

| Phase | Status | Catatan |
|---|---|---|
| 0 — Fondasi DB & keamanan | ✅ Selesai (2026-08-22) | 2 migrasi diterapkan; seed akun Line Art; smoke 11/11 |
| 1 — Routing peran login | ✅ Selesai (2026-08-22) | guard 3 jalur terverifikasi browser |
| 2 — Portal Line Art | ✅ Selesai (2026-08-22) | daftar/search/CRUD draft terverifikasi live |
| 3 — Admin + notifikasi | ✅ Selesai (2026-08-22) | Terima/Batal/Tolak + badge, verifikasi live |
| 4 — Bukti pelunasan + E2E | ✅ Selesai (2026-08-22) | tujuan di PDF; E2E 27/27 |
| 5 — Audit | ✅ Selesai (2026-08-22) | negatif-test 23/23; temuan anon-grant ditutup |

**🎉 SEMUA FASE SELESAI (2026-08-22).** Fitur Portal Distributor "Line Art by CINO" siap pakai.
Yang tersisa hanyalah **langkah manual pemilik**: serahkan email+password akun Line Art (sudah
dibuat di dashboard Supabase) kepada Line Art agar mereka mulai input pengajuan.
