<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# UI: pakai Base UI (`@base-ui/react`), BUKAN Radix/shadcn

Komponen di `src/components/ui/*` dibangun di atas **Base UI**. Konvensi komposisinya
berbeda dari Radix/shadcn yang ada di training data. **Jangan pakai `asChild`** — Base UI
tidak mengenalnya, propnya diabaikan diam-diam sehingga elemen jadi tersarang
(mis. `<button>` di dalam `<button>`) → **hydration error**.

Gunakan prop **`render`** untuk komposisi:

```tsx
// ❌ SALAH (pola Radix) — menghasilkan <button> di dalam <button>
<SheetTrigger asChild>
  <Button variant="ghost">...</Button>
</SheetTrigger>

// ✅ BENAR (pola Base UI) — child jadi isi elemen yang di-render
<SheetTrigger render={<Button variant="ghost" />}>
  <Menu className="h-5 w-5" />
</SheetTrigger>

// ✅ Button yang di-render sebagai elemen NON-button (mis. <a>/<Link>):
//    wajib set nativeButton={false} agar `type="button"` tidak ikut menempel
<Button variant="outline" nativeButton={false} render={<Link href="/products" />}>
  <ArrowLeft className="h-4 w-4" /> Kembali
</Button>
```

Berlaku untuk semua trigger Base UI: `SheetTrigger`, `DialogTrigger`,
`DropdownMenuTrigger`, `SelectTrigger`, `PopoverTrigger`, dst.

## `<Select>` WAJIB diberi prop `items` (value→label)

Base UI `Select.Value` secara default menampilkan **value mentah**, bukan label.
Kalau `value`-nya berupa id (UUID) atau kode (`cash`, `in`, `all`), trigger akan
menampilkan teks acak seperti `37a3bfa3-5edc-...` alih-alih nama item. Solusinya:
oper array `{ value, label }` ke prop **`items`** pada `<Select>` (root).

```tsx
// ❌ SALAH — trigger menampilkan UUID/kode mentah
<Select value={walletId} onValueChange={setWalletId}>
  <SelectTrigger><SelectValue placeholder="Wallet" /></SelectTrigger>
  <SelectContent>
    {wallets.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
  </SelectContent>
</Select>

// ✅ BENAR — `items` memetakan value→label, jadikan sumber SelectItem juga
const items = wallets.map((w) => ({ value: w.id, label: w.name }));
<Select items={items} value={walletId} onValueChange={(v) => setWalletId(v ?? "")}>
  <SelectTrigger><SelectValue placeholder="Wallet" /></SelectTrigger>
  <SelectContent>
    {items.map((it) => <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>)}
  </SelectContent>
</Select>
```

Catatan: `onValueChange` memberi `string | null` (bukan `string`). Kalau state-nya
`string`, tampung dengan `v ?? ""` (atau default lain) supaya tidak error TypeScript.

### Nilai kosong: pakai `|| null`, JANGAN `|| undefined`

Base UI menentukan controlled/uncontrolled dari render pertama: value `undefined`
= *uncontrolled*, selain itu (termasuk `null`) = *controlled*. Kalau state awal `""`
lalu ditulis `value={walletId || undefined}`, render pertama jadi `undefined`
(uncontrolled), begitu dipilih berubah jadi string (controlled) → **console error
"changing uncontrolled to controlled"** + value mentah (UUID) bocor ke trigger.

```tsx
// ❌ SALAH — render pertama `undefined` (uncontrolled), lalu controlled
<Select value={walletId || undefined} ...>

// ✅ BENAR — `null` tetap controlled sejak awal, placeholder tetap muncul
<Select items={items} value={walletId || null}
  onValueChange={(v) => setWalletId(v ?? "")} ...>
```

`null` adalah sentinel "belum dipilih" di Base UI dan tetap menampilkan
`placeholder` pada `<SelectValue>`. Untuk value enum yang selalu terisi
(mis. `method`, `type`, `status`) cukup `value={method}` tanpa `|| null`.

## Riwayat perbaikan

- **2026-09-17 — Hero dashboard mobile 2×2 + badge "Email terkirim" invoice.** Dua revisi
  digabung satu batch (kurangi email deploy Vercel):
  - **Hero dashboard mobile jadi grid 2×2** (`dashboard/dashboard-mobile.tsx` + `globals.css`).
    Dulu hero cuma menampilkan **Laba Bersih · periode ini** (+2 pill). Kini di bawah angka
    laba ada label **"Aktivitas periode"** lalu **4 metrik** dalam grid 2×2: **Penjualan,
    Pembelian, Beban Ops, Pribadi** (`formatIDRShort`). **Penting:** 4 angka itu bukan rumus
    laba — makanya diberi judul "Aktivitas periode" (laba akrual = penjualan − HPP terjual −
    beban − pribadi − PPh, bukan penjumlahan pill). CSS: `.ma-hero-acti` (label kecil uppercase)
    baru + `.ma-hero-pills` `margin-top:0` (label yang beri jarak). Grid `1fr 1fr` → 4 anak
    auto-wrap jadi 2×2. Var `pengeluaran` yg tak terpakai dibuang. Diverifikasi via E2E login
    (viewport 375px): hero render 2×2 rapi, angka laba tetap di atas.
  - **Invoice bulanan — badge "Email terkirim" (centang)** (`invoices/invoice-list.tsx`).
    Samakan dgn Riwayat Bayar Hutang: bila `email_sent_at` terisi, tampil badge hijau
    `CheckCircle2` "Email terkirim" di kolom Status (tabel desktop) & baris badge (kartu
    mobile). Data `email_sent_at` sudah ada di `v_monthly_invoices` + tipe `MonthlyInvoice`.
  - tsc bersih.

- **2026-09-17 — Revisi UX pasca-redesign mobile (RAB, Beli&Jual, dialog email).**
  Tiga revisi dari pemakaian nyata di HP, digabung satu batch:
  - **RAB editor — tombol "+ Tambah Item/Termin" pindah ke BAWAH baris** (ketiga tabel:
    Penawaran/Pengeluaran/Termin di `rab/rab-editor.tsx`). Dulu di header (pojok atas) →
    kalau item banyak harus scroll jauh ke atas hanya untuk menambah. Kini tombol lebar
    putus-putus tepat di atas Grand Total (hanya saat `!readOnly`). Berlaku web + mobile.
  - **Beli & Jual (`purchases/quick-deal-form.tsx` + `actions.ts`):**
    (1) **BUG error `invalid input syntax for type date: "2026-09"`** saat metode Invoice
    Bulanan — `createQuickDeal` mengirim `period_month` mentah dari `<input type="month">`.
    Fix di `purchases/actions.ts`: append `-01` bila `sale_method==="monthly_invoice"`
    (samakan dgn `create_sale` di `sales/actions.ts`). (2) **UI mobile**: baris barang
    (4 input + 2 ikon di 12 kolom) → ikon menimpa kolom "Jual"; disusun ulang jadi
    (nama + ikon) lalu (Qty/Beli/Jual 3 kolom seimbang). Footer dipaksa `flex-row` (3
    statistik + 2 tombol) → tombol Simpan kepotong; kini `flex-col` di mobile
    (`sm:flex-row`), tombol full-width. Footer sale-form & purchase-form disamakan pola.
  - **Dialog Kirim Email (`components/shared/send-email-dialog.tsx`)** — dipakai bersama
    (Riwayat Bayar Hutang, NOTA penjualan, invoice). Dulu tanpa `max-height`/scroll →
    konten tinggi meluber, tombol **Kirim** keluar layar & tak bisa diklik. Fix: DialogContent
    `flex max-h-[90dvh] flex-col` + isi `flex-1 overflow-y-auto` + footer sticky (border-t),
    tombol full-width di mobile. Pakai centering standar (bukan override `!important` yang
    dulu diabaikan iOS). tsc bersih.

- **2026-09-16 — Redesign MOBILE "PBMS Saku" (fintech premium, light+dark) — Fase 1–7.**
  Tampilan mobile dibangun ulang jadi seperti aplikasi finansial terpasang (bukan web yang
  dikecilkan), **tanpa mengubah desktop**. Dokumen kerja + checkpoint lengkap (fase, pola,
  cara verifikasi, sisa pekerjaan) di **`docs/MOBILE-REDESIGN.md`** — baca itu sebelum
  melanjutkan.
  - **Prinsip:** *adaptive*, bukan responsive murni. Data/RPC/server action/PDF **dipakai
    bersama** desktop — **nol tabel baru, nol beban DB/storage**. Cabang tampilan: list yang
    fetch di server render **sekali** lalu tampil dua versi via CSS (`hidden lg:block` desktop /
    `lg:hidden` mobile); yang fetch di klien (dashboard) render dua komponen dari state sama.
    Hal yang tak boleh mount di mobile (grafik Recharts saat `display:none` → error width(0))
    dijaga hook `useIsMobile()` (`src/components/shared/use-is-mobile.ts`).
  - **Design system** `ma-*` + token `--m-*` di `globals.css` (bagian "DESIGN SYSTEM MOBILE"):
    permukaan pakai token app (ikut tema), aksen **teal (Athaya) + oranye (Cetak Ide)**.
    `formatIDRShort` ditambah di `lib/utils/currency.ts`.
  - **FIX BUG FONT (seluruh app, desktop+mobile):** app ternyata render **Times New
    Roman** (serif) karena `@theme inline { --font-sans: var(--font-sans) }` di
    `globals.css` **sirkular** → kosong → fallback serif; Plus Jakarta Sans di-load
    next/font tapi tak pernah dipakai. Diperbaiki: `--font-sans` → `var(--font-jakarta)`
    + fallback (mono juga diberi fallback). Ditambah **Sora** (`--font-sora` di
    `layout.tsx`) sebagai font **display** (`--font-display`) untuk angka & judul besar
    mobile — diterapkan ke `.ma-num`, `.ma-h1`, `.ma-sec h3` (hero saldo, KPI, nominal,
    judul). Terverifikasi computed `font-family` body = "Plus Jakarta Sans" (bukan lagi
    Times New Roman). Catatan: `next/font` mengunduh font saat build — butuh jaringan.
  - **Fase 1 — Fondasi + Beranda:** bottom-nav 4 tab (Beranda/Transaksi/Laporan/Menu) + FAB
    tengah → bottom-sheet "Catat Baru" (Beli→Jual→Pengeluaran→Invoice→Transfer);
    `bottom-nav.tsx` ditulis ulang (disembunyikan di lg via media query `.ma-bnav`, BUKAN
    `lg:hidden` Tailwind karena `.ma-*` di luar @layer selalu menang). Halaman **Menu**
    (`menu/page.tsx`) = hub semua fitur dari `NAV_GROUPS` (tak ada menu terpotong).
    **Dashboard mobile** (`dashboard/dashboard-mobile.tsx`): hero Laba Bersih, aksi cepat,
    KPI Piutang/Hutang, sparkline tren, ringkasan, invoice tertunda, garansi. `dashboard-client.tsx`
    render mobile+desktop dari satu fetch; `dashboard/page.tsx` disederhanakan (header+search
    pindah ke cabang desktop). `layout.tsx` padding bawah dinaikkan ke 6rem (ruang FAB).
  - **Fase 2 — Tab inti:** **Riwayat Transaksi** komponen mobile terpisah
    (`transactions/transaction-list-mobile.tsx`): ringkasan Masuk/Keluar/Net, search +
    **`FilterSheet`** (komponen reusable baru `src/components/mobile/filter-sheet.tsx` = filter
    dalam bottom-sheet), kartu per transaksi. **Laporan** = Tier B (sudah kartu+chart responsif,
    diverifikasi). PageHeader desktop disembunyikan di mobile untuk halaman ber-judul-mobile-sendiri.
  - **Fase 3 — List transaksi (Pembelian/Penjualan/Pengeluaran):** pola *in-place* (satu
    komponen, handler & dialog dipakai bersama) — tabel dibungkus `hidden lg:block`, tambah
    daftar **kartu `lg:hidden`** + **ringkasan kompak** `lg:hidden` (desktop `hidden lg:grid`)
    + tombol toolbar diberi `flex-wrap` (fix meluber). Penjualan: kartu + expand item + aksi
    NOTA/Email/Lunas/Hapus + badge brand/status. File: `purchases/purchase-list.tsx`,
    `sales/sale-list.tsx`, `shared/expenses-manager.tsx`.
  - **Fase 4 — Master data (Stok/Aset/Client/Distributor):** keempatnya pakai tabel →
    Tier A, pola sama Fase 3 (tabel `hidden lg:block` + kartu `lg:hidden`). Stok Barang
    (`products/product-manager.tsx`): kartu badge stok/harga/garansi + aksi sesuaikan/
    riwayat/ubah/hapus. Aset (`assets/asset-manager.tsx`): kartu thumbnail foto + status
    garansi + repair/riwayat/ubah/hapus. Client (`clients/client-manager.tsx`): kartu +
    360/ubah/hapus. Distributor (`distributors/distributor-manager.tsx`): kartu + ubah/hapus.
  - **Fase 5 — Layanan client (Invoice/Maintenance/Network/CCTV/RAB):** semua list pakai
    tabel → Tier A, pola sama. Invoice (`invoices/invoice-list.tsx`): kartu brand+status +
    Lihat/Hapus. Maintenance (`maintenance/contract-manager.tsx`): kartu biaya/bln+tempo+
    status. Network (`network/network-manager.tsx`) & CCTV (`cctv/cctv-manager.tsx`): kartu +
    `PasswordCell` (kredensial WiFi/perangkat/DVR) + repair/riwayat/ubah/hapus. RAB
    (`rab/rab-list.tsx`): kartu nilai/diterima/sisa/laba + Lihat/Hapus. **Belum:**
    `invoices/[id]/invoice-lines.tsx` & `rab/rab-editor.tsx` (detail/editor → Fase 7).
  - **Fase 6 — Analisa & sistem:** Piutang & Hutang (Tier A) — `piutang/piutang-client.tsx`
    (kartu + info overdue) & `piutang/hutang-client.tsx` (kartu per nota + checkbox pilih +
    dialog bayar); `riwayat-bayar-client.tsx` sudah kartu. Pemeriksaan Data, Pengaturan
    (tab+form), Pengajuan Distributor (kartu+segmented tab) = Tier B, sudah kartu/responsif,
    diverifikasi OK.
  - **Fase 7 — Form full-screen & invoice-lines:** kelas `.ma-dialog-full` (globals.css)
    membuat DialogContent form **full-screen di mobile** (<640px), terpusat di desktop —
    dipakai `sales/sale-form.tsx`, `purchases/purchase-form.tsx`, `purchases/quick-deal-form.tsx`.
    **Gotcha Tailwind v4:** `-translate-x/y-1/2` memakai properti CSS `translate` (bukan
    `transform`) → reset WAJIB `translate: none !important` (kalau cuma `transform:none`,
    dialog tetap tergeser -50% & terpotong). Diverifikasi dialog box = {0,0,390,844}.
    `invoices/[id]/invoice-lines.tsx` rincian baris tabel→kartu + Grand Total mobile.
  - **Fase 7 (poles):** toolbar list → **FilterSheet** di mobile (Pembelian/Penjualan/
    Pengeluaran): cari + tombol Filter (sheet berisi tanggal/jenis), field tanggal inline
    `hidden lg:block`, tanpa duplikasi tombol aksi. **Header mobile** (`app-header.tsx`):
    hamburger dihapus (redundan dgn tab Menu) → brand teal "PBMS-IT" di kiri. rab-editor
    sudah responsif (tak diubah). **Sisa opsional (fungsional, bukan bug):** portal
    distributor `/portal` & dialog pendek expense/product/asset full-screen.
  - **FIX — `<Select>` salah posisi (popup nongol di pojok ATAS layar HP).** Base UI Select
    default `alignItemWithTrigger=true` (item terpilih ditempatkan MENIMPA trigger, ala native)
    → di dialog full-screen/mobile, bila item terpilih bukan pertama / banyak item / trigger
    dekat atas, popup meluber ke atas layar & salah posisi. Diperbaiki: default
    `alignItemWithTrigger={false}` di `components/ui/select.tsx` → dropdown biasa (anchored di
    BAWAH trigger, flip ke atas hanya bila sempit). Global (semua Select, desktop+mobile),
    lebih konsisten. Diverifikasi: dropdown Metode Bayar kini muncul tepat di bawah trigger.
  - **FIX — form full-screen mobile MALAH rusak di Safari iOS (dialog tergeser & terpotong).**
    Kelas `.ma-dialog-full` (override `inset`/`translate`/`width` via `!important` + media query)
    LOLOS di Chromium tapi **tidak diterapkan Safari iOS** → dialog form penjualan tergeser
    separuh keluar layar (dites via incognito iOS = bukan cache). **Solusi: buang full-screen**,
    kembalikan form Penjualan/Pembelian/quick-deal ke **modal terpusat bawaan**
    (`w-[calc(100%-1rem)] max-h-[92dvh] sm:max-w-*`, memakai centering `-translate-x/y-1/2`
    BAWAAN yang TERBUKTI jalan di iOS — dialog lain memang normal). Kelas `.ma-dialog-full`
    dihapus dari `globals.css` + 3 form. **Pelajaran:** jangan override positioning Base UI
    Dialog dgn unlayered `!important`; iOS Safari bisa mengabaikannya (Chromium tidak).
  - **Verifikasi:** `tsc --noEmit` bersih di tiap fase; verifikasi visual **via login E2E**
    (akun test `E2E_TEST_*` di `.env.local`) + Playwright screenshot viewport 390px (light &
    dark) — semua render benar, tanpa page-error. Worktree tak punya node_modules → disambung
    junction ke checkout utama; `next dev` Turbopack menolak junction, jadi pakai **webpack**
    (`npm run dev -- --webpack --port 3100`; config `preview-webpack` di `.claude/launch.json`).
    Catatan: akun test kosong → daftar kartu terverifikasi struktur (tsc + tanpa error), belum
    dengan data nyata.
  - **OPSIONAL tersisa (lihat docs, bukan bug):** portal distributor `/portal` (login
    terpisah) & dialog pendek (expense/product/asset) full-screen. Sisanya sudah selesai.

- **2026-09-16 — RAB: tombol Unduh Excel (detail RAB, workbook editable).** Menu RAB → Detail RAB.
  User ingin mengedit RAB di Excel bila ada yang kurang. Tombol **Unduh Excel** (`FileSpreadsheet`)
  di header `rab/[id]/page.tsx`, di samping Unduh PDF → route baru
  **`src/app/api/rab/[id]/excel/route.ts`** (exceljs, `runtime=nodejs`, cek `auth.getUser`).
  Satu sheet "RAB" berisi keempat bagian: 1. Penawaran, 2. Pengeluaran (+kolom Kategori),
  Rekap per Kategori, 3. Termin, Ringkasan.
  - **Editable = pakai RUMUS** (pola sama route reports): Total per baris = `Qty*Harga`,
    Grand Total = `SUM(...)`, Laba = `RAB−Pengeluaran`, Sisa = `MAX(RAB−Diterima,0)`. **Rekap
    per kategori pakai `SUMIF`** atas kolom Kategori (C) & Total (F) tabel pengeluaran → ikut
    berubah saat user mengedit qty/harga. % = `IFERROR(total/grandExpense)`. Baris tanpa kategori
    ditulis literal **"Lain-lain"** di kolom Kategori agar SUMIF-nya cocok.
  - Kolom seragam sepanjang sheet: 1 No · 2 Nama · 3 Kategori · 4 Qty · 5 Harga · 6 Total/Nominal
    · 7 Tanggal · 8 Wallet. `moneyFmt` di kolom 5 & 6. Pakai helper bersama
    `lib/reports/export-helpers.ts` (`styleTitle/styleTableHeader/styleTotal/moneyFmt/xlsxResponse`)
    + `sectionRow` lokal (latar teal/amber selebar tabel). Rekap memakai `rabCategoryRecap` untuk
    urutan/daftar kategori.
  - **Verifikasi:** `tsc` bersih; generate `.xlsx` dari data RAB **nyata** di DB lalu **dibuka
    ulang** exceljs → valid (26 baris, semua rumus F well-formed: `D*E`, `SUM`, `F8-F13`,
    `MAX(...)`, rekap `E/F13`). Verifikasi visual di app tak bisa (di balik login).

- **2026-09-15 — RAB: kategori pengeluaran + rekap per kategori (layar & PDF).** Menu RAB →
  *2. Detail Pengeluaran (Realisasi)*. Tujuan: melihat kategori pengeluaran terbesar (mis.
  CCTV vs TRANSPORT vs TUKANG). Tiap baris pengeluaran dapat **dropdown Kategori (opsional)**;
  di bawah tabel muncul **Rekap per Kategori** urut **terbesar → terkecil** (total + % + bar) —
  sama di layar (`rab-editor.tsx`) & PDF (`rab-pdf.tsx`), dihitung oleh helper bersama
  `src/lib/rab/category-recap.ts` (`rabCategoryRecap`) supaya angka identik. Baris tanpa
  kategori digabung ke **"Lain-lain"**.
  - **Prinsip:** kategori MURNI label + pengelompokan tampilan — **nol dampak** ke wallet, laba,
    HPP, piutang, laporan keuangan, & Pemeriksaan Data (pola sama fitur brand). Hanya baris
    `expense` yang berkategori; baris `budget` selalu null.
  - **Master list** memakai tabel `categories` yang sudah ada, **tipe enum baru `rab_expense`**,
    dikelola di **Pengaturan → Kategori** (panel & dropdown muncul otomatis begitu
    `CATEGORY_TYPE_LABELS` di `types/db.ts` ditambah — `category-manager.tsx` generik per type).
  - **Migrasi (2 file, sengaja dipisah):** PostgreSQL melarang MEMAKAI nilai enum baru pada
    transaksi yang sama dengan `ALTER TYPE ... ADD VALUE`. Jadi
    `20260915_rab_expense_category_enum.sql` (hanya ADD VALUE, terapkan **autocommit/no-tx**
    lebih dulu) lalu `20260915_rab_item_category.sql` (kolom `rab_items.category_id uuid null`
    FK→categories `on delete set null` + `save_rab` di-CREATE OR REPLACE menambah `v_category`/
    kolom category_id + **seed 11 kategori** utk tiap pemilik data, idempoten). Terapkan via
    `scripts/apply-migration.mjs` (pakai `pg` npm; psql korup). Seed set `user_id` **eksplisit**
    (koneksi langsung → `auth.uid()` null). Kategori awal: CCTV, AUDIO, NETWORK, TRANSPORT,
    KOMPUTER, LISTRIK, ABSENSI, MAKAN, LAIN-LAIN, TUKANG, TARIK KABEL.
  - **File:** `types/db.ts` (+`rab_expense` di CategoryType & LABELS), `types/phase7.ts`
    (`RabItem.category_id`), `rab/actions.ts` (`RabItemInput.category_id`), `rab/rab-editor.tsx`
    (ExpenseRow +category_id, Select kategori, panel rekap), `rab/new/page.tsx` &
    `rab/[id]/page.tsx` (fetch categories type=rab_expense), `api/rab/[id]/pdf/route.ts`
    (map categoryNames) & `pdf/rab-pdf.tsx` (kolom Kategori + blok rekap).
  - **Verifikasi:** smoke DB (rollback) — `save_rab` simpan category_id utk expense (budget &
    expense tanpa kategori tetap null) ✓; 11 kategori ter-seed ✓; `tsc --noEmit` bersih.
    Verifikasi visual tak bisa (di balik login; worktree tanpa node_modules → dev server tak
    jalan, Turbopack tolak junction ke luar root).

- **2026-08-25 — Portal distributor: Terima Pengajuan sekaligus JUAL (dropship).** Untuk barang
  yang Line Art kirim **langsung ke lokasi client** (mis. kertas ke Rob Peetoom Seminyak; tak
  pernah di gudang). Dialog **Terima** (`distributor-orders/orders-client.tsx`) dapat toggle
  **"Langsung jual ke client (dropship)"** (default MATI = perilaku lama, pembelian saja). Saat
  aktif: pemilik isi **client** (dipetakan dari teks tujuan), **brand** (default **Cetak Ide**),
  **metode** (default **Invoice bulanan**, bisa Tunai/Transfer+wallet), **periode**, harga jual
  & garansi, plus toggle **Aset**/**Aktif** per baris. RPC baru
  `accept_distributor_order_dropship` (migrasi `20260825_distributor_order_dropship.sql`,
  owner-scoped `SECURITY DEFINER`) menjalankan `create_purchase(is_credit=true)` **lalu**
  `create_sale` dalam **satu transaksi** — persis pola `create_quick_deal` (audit 3.1); qty beli
  = qty jual → **stok bersih 0**; gagal jual → pembelian **rollback**.
  - **Toggle Aset/Aktif = setelan KATALOG produk** (`products.track_as_asset`/`is_active`),
    **sama seperti menu Stok Barang** — diterapkan ke produk (baru/lama) **sebelum** `create_sale`
    (agar cabang aset benar). Berlaku utk penjualan berikutnya; **nota terjual terkunci**. Produk
    lama diberi tanda "· produk lama" + pra-isi nilai saat ini (fetch `v_product_stock`).
  - **Kolom `distributor_orders.sale_id`** (nullable) = **jejak telusur saja**; TAK memicu status
    portal (kunci portal tetap **hutang**, lepas dari invoice client — Prinsip #9 di docs).
  - **Laporan/audit aman:** mekanika = gabungan RPC teruji → hutang, HPP terkunci, invoice/
    piutang, kas konsisten. **Pemeriksaan Data tetap 23 cek, "Data sehat".** Batal Terima
    terkunci setelah terjual (guard `delete_purchase`) → reversal manual (balik penjualan dulu).
  - **Verifikasi:** smoke rollback DB (beli 130rb hutang + jual 210rb cetak_ide → `CTK/2026/08/001`,
    stok net 0, aset dibuat hanya utk `track_as_asset=true`, order accepted + purchase_id + sale_id);
    E2E 3/3 (`/distributor-orders` render + "Data sehat"); `tsc` bersih. Detail & aturan lengkap:
    `docs/PORTAL-DISTRIBUTOR.md` (Log Revisi 2026-08-25 + Prinsip #9).

- **2026-08-22 — E2E smoke test (Playwright) — audit tampilan semua menu.** Menutup celah
  yang membuat bug "daftar Pembelian kosong" lolos: tak ada yang membuka halaman sambil login.
  `@playwright/test` (devDep) + `playwright.config.ts` (webServer `npm run dev -- --port 3100`,
  `process.loadEnvFile('.env.local')`, 2 project: `setup`→`smoke`). `e2e/auth.setup.ts` login
  sekali (`#email`/`#password`, tombol "Masuk", tunggu `**/dashboard`) → simpan sesi ke
  `e2e/.auth/state.json` (gitignored). `e2e/smoke.spec.ts`: buka **23 menu** utama, assert (a)
  tak dilempar ke `/login`, (b) `<h1>` (PageHeader) tampil — bila query gagal, `unwrap`
  melempar → Next error page tanpa `<h1>` → **test merah**. Plus 1 test `/data-check` harus
  lapor **"Data sehat"** (validasi data lewat UI). **Kredensial akun test** dari `.env.local`:
  `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` (akun test KHUSUS, bukan akun utama; jangan di-commit).
  Jalankan: `npm run test:e2e`. **Diverifikasi: 25/25 lulus (1.9 mnt).** Route dinamis `[id]`
  dilewati. Butuh sekali `npx playwright install chromium` di mesin baru/CI.

- **2026-08-22 — Menu Pembelian: tombol "Semua" + baris expand, & query menyurface error.**
  Tindak lanjut bug daftar Pembelian kosong. (1) `purchase-list.tsx`: tombol **"Semua"**
  (`showAll` → `from=""`,`to=""`; varian tombol jadi solid saat aktif; judul SummaryCard →
  "Total Pembelian (Semua)") untuk melihat riwayat tanpa batas tanggal; **baris bisa di-expand**
  (pola sama `sale-list.tsx`: `Fragment`+`expanded:Set`+chevron, tabel rincian item
  nama/qty/harga/subtotal; tombol Hapus dibungkus `stopPropagation`). (2) Helper baru
  `src/lib/supabase/unwrap.ts` — `unwrap(res, label)` **melempar** bila `res.error` (bukan
  menelan jadi `data ?? []`), dipakai di `purchases/page.tsx` untuk keenam query. Jadi query
  gagal LANTANG (error boundary + log), bukan tampil "kosong". **Rollout `unwrap` ke halaman
  list lain masih terbuka** (baru Pembelian). `tsc` bersih; verifikasi visual tak bisa
  (di balik login) — perubahan UI mengikuti pola `sale-list.tsx` yang sudah terbukti.

- **2026-08-22 — Tanda tangan email ikut BRAND (lanjutan fitur 2 brand).** Sebelumnya
  `composeEmail(body)` selalu tanda tangan **Athaya** meski lampiran PDF-nya sudah ber-tema
  brand. Kini `composeEmail(body, brand?)` memilih tanda tangan per brand. `signature.ts`:
  `SIGNATURES: Record<Brand, ...>` — Athaya (teal `#1CA9C9`/`#0E7C9B`, logo
  `public/email-logo.png`, cid `athaya-logo`) & **Cetak Ide** (nama "Cetak Ide", tagline
  "Creative Advertising - Design - Printing", **kontak SAMA** via konstanta `CONTACT`, warna
  aksen **oranye `#F8AB01`**, logo `public/email-logo-cetak-ide.png`, cid `cetak-ide-logo`).
  Logo di-`readFile` per brand; bila file tak ada → tanda tangan tetap terkirim tanpa `<img>`
  (graceful). Pemanggil: `sendInvoiceEmail` → `composeEmail(body, pdf.invoice.brand)`,
  `sendSaleEmail` → `composeEmail(body, pdf.nota.brand)`. **Pelunasan hutang** (`sendHutangPaymentEmail`,
  purchases) tetap Athaya (default) — itu bisnis→distributor, bukan storefront. Catatan mailer:
  `MailAttachment` tak mendeklarasikan `cid` di TS, tapi objek dari `loadLogo` membawa `cid`
  saat runtime → nodemailer memakainya untuk inline (duck-typed; pola lama yang sudah jalan).
  `tsc` bersih; kedua file logo sudah ada di `public/`.
  - **BUG FIX — daftar Pembelian selalu KOSONG (regresi dari fitur Hutang).** User lapor
    history pembelian tak muncul meski filter tanggal benar. Sebab: fitur Hutang (20260821)
    menambah FK **`purchases.paid_wallet_id` → wallets**, jadi `purchases` kini punya **2 FK
    ke wallets** (`wallet_id` + `paid_wallet_id`). Query `purchases/page.tsx` memakai embed
    `wallet:wallets(name)` **tanpa hint FK** → PostgREST ambigu → **query gagal, data null,
    seluruh daftar kosong** (filter tanggal cuma teralihkan perhatian; bukan penyebab).
    Fix: `wallet:wallets!wallet_id(name)` (persis pola `sales/page.tsx` yang dulu sudah
    diperbaiki untuk masalah identik). Query purchases lain sudah aman (reports/piutang pakai
    hint atau tanpa embed wallet). Pelajaran: **tiap tambah FK kedua ke tabel yang sudah
    di-embed, sisir semua `.select` embed tabel itu & tambah `!fk_column`.**

- **2026-08-21 — Backup DB murni Node (buang pg_dump.exe yang korup).** `npm run backup`
  gagal: `spawnSync tools/pgsql/bin/pg_dump.exe UNKNOWN`. Sebab: `pg_dump.exe` **korup di
  level NTFS** ("file or directory is corrupted") — pola berulang di mesin ini (dulu psql.exe
  juga). Ukuran file terlihat normal tapi blok datanya rusak → tak bisa dieksekusi. `tools/`
  gitignored → tak bisa `git checkout`. **Solusi (pilihan user):** tulis ulang
  `scripts/backup.mjs` **murni Node** pakai paket `pg` (sudah dependency) — tak ada .exe rapuh
  lagi, perintah tetap `npm run backup`. Output ke `backups/`:
  - `schema_<ts>.sql` = **gabungan seluruh `supabase/migrations/*.sql`** berurutan (skema =
    sumber kebenaran, sudah di git).
  - `data_<ts>.sql` = `INSERT` semua tabel `public`. Tiap kolom di-`::text` di query (aman
    untuk uuid/jsonb/bytea/timestamp; tujuan kolom yang parse), `standard_conforming_strings=on`
    + gandakan kutip tunggal. Kolom **generated** (mis. `sale_items.subtotal`) **dilewati**
    (`is_generated='NEVER'`). File dibungkus `session_replication_role=replica` (bypass FK/
    trigger saat load massal) + BEGIN/COMMIT. Restore: schema dulu, lalu data.
  - Diuji nyata: 332 baris / 26 tabel; subtotal generated benar-benar dilewati, kolom `brand`
    ikut. Kartu Backup di /settings diperbarui (tak lagi sebut pg_dump/tools). `tools/pgsql/`
    kini sepenuhnya tak dipakai (backup & migrasi sama-sama pakai `pg` npm).

- **2026-08-21 — DUA BRAND penjualan/invoice: Athaya Computer & Cetak Ide (Fase A+B).**
  Usaha berkembang → dipisah dua brand: **Athaya Computer** (komputer/printer/servis) &
  **Cetak Ide** (ATK/percetakan/desain). Client YANG SAMA bisa punya **2 invoice bulanan
  terpisah** di bulan sama (satu per brand). Keputusan user: **entitas sama** (rekening
  bank, alamat, kontak, PPh SAMA) → beda hanya **kop (nama+tagline) & tema warna**.
  Aturan penting bila menambah fitur terkait:
  - **Prinsip:** brand murni dimensi **label + pengelompokan + tampilan**. TIDAK menyentuh
    alur uang (wallet, HPP, PPh 23, piutang, stok). Laporan keuangan & Pemeriksaan Data
    tak berubah. Brand tak pernah masuk hitungan keuangan.
  - **Penomoran:** Athaya tetap seri **`INV/YYYY/MM/NNN`** (invoice lama tak diusik),
    Cetak Ide seri baru **`CTK/YYYY/MM/NNN`**. Dua prefix tak pernah bentrok di index unik.
    Helper `next_invoice_no(period, brand)` (MAX+1 lalu loop; regex per-prefix) dipakai
    bersama 3 fungsi penomoran.
  - **Brand ditandai PER-NOTA** (dropdown "Atas Nama (Brand)" di form penjualan, default
    Athaya). Untuk invoice bulanan, brand penjualan = brand invoice-nya.
  - **Maintenance selalu `athaya`** (servis komputer). `issue_maintenance_charges` membatasi
    draft yang boleh digabungi ke `brand='athaya'`.
  - **Migrasi `20260821_invoice_brand.sql`** (diterapkan via `scripts/apply-migration.mjs`,
    psql.exe masih korup): kolom `brand text not null default 'athaya'` + check di `sales`
    & `monthly_invoices` (data lama otomatis backfill 'athaya' — diverifikasi 8 invoice +
    19 sales). Fungsi:
    - `next_invoice_no(date, text)` **baru** — nomor invoice berikut per (periode, brand).
    - `find_or_create_invoice` → **4-arg** (+`p_brand` default 'athaya'; DROP+CREATE).
      Pencocokan invoice belum-lunas kini WAJIB brand sama → penjualan Cetak Ide tak
      nyasar ke invoice Athaya & sebaliknya.
    - `create_sale` → **9-arg** (+`p_brand` default 'athaya' di AKHIR; DROP+CREATE).
      `create_quick_deal` (memanggil 8-arg) tetap jalan lewat DEFAULT. Simpan `sales.brand`
      + teruskan brand ke find_or_create_invoice.
    - `generate_monthly_invoice` → **4-arg** (+brand; DROP+CREATE) — mengelompokkan hanya
      penjualan brand terkait. (Fungsi ini tak terpasang di UI, dijaga konsisten.)
    - `issue_maintenance_charges` & `add_invoice_item` → CREATE OR REPLACE (tanda tangan
      sama). `add_invoice_item` **mewarisi brand dari invoice**-nya.
    - `v_monthly_invoices` dibuat ulang (kolom `brand` di AKHIR SELECT) + `security_invoker=on`
      dipertahankan.
    - **Smoke test (rollback, set request.jwt.claims):** Athaya→INV/2026/08/003,
      Cetak Ide (client+periode sama)→CTK/2026/08/001 (invoice terpisah), panggil ulang
      Cetak Ide→menyatu. Semua ✓.
  - **PDF 2 tema (Fase B):** `types/phase4.ts` — `BUSINESS_IDENTITIES` (map athaya/cetak_ide,
    tiap identitas +`theme`), `businessIdentity(brand)`, `Brand`, `BRAND_LABELS`, `BRAND_TONE`,
    `toBrand()`. `BUSINESS_IDENTITY` tetap = athaya (mundur-kompatibel: export/report/tanda
    tangan email). Athaya `#0f766e` (teal), **Cetak Ide `#F8AB01` (oranye)** — nama "CETAK IDE",
    tagline "Creative Advertising - Design - Printing"; **sisanya sama**. `invoice-pdf.tsx` &
    `sale-pdf.tsx`: StyleSheet statis → `makeStyles(theme)`, semua warna teal → `theme`;
    komponen pilih tema via `businessIdentity(invoice.brand)` / `businessIdentity(nota.brand)`.
    `build-sale-pdf.ts` select+teruskan `sale.brand` ke `SaleNota.brand`; `build-invoice-pdf.ts`
    sudah `v_monthly_invoices.*` (brand ikut).
  - **UI:** form penjualan (`sale-form.tsx`) dropdown brand; badge brand (Athaya teal /
    Cetak Ide oranye) di `invoice-list.tsx`, `sales/sale-list.tsx`, `invoices/[id]/page.tsx`
    (pencarian invoice juga cocokkan label brand). `SOFT_TONES.teal` ditambah. `SaleRow.brand`
    & `MonthlyInvoice.brand` ditambah; `createSale` action teruskan `p_brand`.
  - **CATATAN scope (email):** tanda tangan/isi email invoice tetap identitas **Athaya**
    (`signature.ts` pakai `BUSINESS_IDENTITY`=athaya) sesuai permintaan "hanya PDF yang
    berubah". Lampiran PDF-nya tetap ber-tema brand yang benar. Bila kelak ingin tanda
    tangan email ikut brand, ganti `composeEmail` agar terima brand.
  - `tsc --noEmit` bersih; verifikasi visual app tak bisa (di balik login).

- **2026-08-21 — Kartu panduan Backup di Pengaturan → Backup & Data.** User sering lupa
  cara backup database. Ditambah **kartu info statis** di atas kartu "Export Semua Data":
  langkah backup lewat Terminal VSCode + tombol **Salin** perintah `npm run backup`
  (di balik layar memakai `pg_dump` portabel `tools/pgsql/`; butuh `SUPABASE_DB_URL`
  Session pooler di `.env.local`; hasil `schema_*.sql`+`data_*.sql` di `backups/`).
  Komponen `settings/backup-guide.tsx` (client, pakai `sonner` toast + clipboard), dipasang
  di `settings/page.tsx` (tab `backup` jadi `space-y-4`, 2 kartu). Murni UI, tak sentuh data;
  `tsc` bersih. Verifikasi visual tak bisa (di balik login).

- **2026-08-21 — Edit/Hapus baris invoice bulanan + Batal Lunas (Tahap 1).** Menu
  Invoice Bulanan → *Lihat Invoice*. Dulu koreksi barang/harga salah = hapus SELURUH
  invoice lalu buat ulang. Kini bisa **edit/hapus PER BARIS** — **hanya invoice BELUM
  LUNAS** agar laporan keuangan tak rusak. Aturan (penting bila menambah fitur terkait):
  - **Prinsip kas:** baris invoice bermetode `monthly_invoice` **tak punya transaksi
    wallet** sampai invoice dilunasi (`create_sale` hanya menambah `monthly_invoices.total`).
    Jadi edit harga / hapus baris pada invoice belum lunas = **NOL dampak kas** — hanya
    menata `sales.total` & `monthly_invoices.total` (plus stok untuk hapus baris barang).
  - **RPC** (migrasi `20260821_invoice_line_edit.sql`, 3 fungsi `SECURITY DEFINER`):
    - `delete_invoice_item(sale_item_id)` — balik stok (hapus **satu** `stock_movements`
      `sale_out` cocok `product_id`+`qty` via `ctid limit 1`; ref_id=sale_id bukan per-item),
      hapus `client_assets` baris itu, hapus `sale_item`, nota kosong ikut terhapus, hitung
      ulang total. Baris **jasa** tak sentuh stok/aset. Guard: invoice ≠ `paid`, baris bukan
      maintenance, **bukan baris terakhir invoice** (blokir → "gunakan Hapus Invoice", cegah
      invoice kosong).
    - `update_invoice_item(sale_item_id, item_name, price)` — harga (semua baris) + nama
      (**baris jasa saja**; barang pakai nama katalog, salah produk = hapus+jual ulang).
      `subtotal` kolom generated → tak di-set manual. Qty **tidak** diedit di Tahap 1.
    - `unpay_invoice(invoice_id)` — **Batal Lunas**: hapus `wallet_transactions`
      (`ref_type='invoice'`) + reset `paid_date/paid_wallet_id/pph_*`, status → `sent` (bila
      `email_sent_at` terisi) / `draft`. Membalik penuh `mark_invoice_paid` (netto+PPh) →
      aman diedit lalu lunas ulang.
  - **Maintenance dikecualikan** dari edit/hapus per-baris (tetap lewat kontrak / hapus
    seluruh invoice). Penanda "sudah ditagih" maintenance = **adanya baris `sales`** periode
    itu; `delete_monthly_invoice` menghapus baris → periode **otomatis** bisa ditagih ulang
    (tak ada flag terpisah). Invoice berisi maintenance saja = sah, dibiarkan.
  - **UI:** `invoices/[id]/invoice-lines.tsx` (baru, client) — tabel rincian interaktif,
    tombol Edit/Hapus per baris hanya saat belum lunas, banner peringatan bila `sent`,
    banner kunci bila lunas. `invoice-actions.tsx` + tombol **Batal Lunas** (dialog netto
    ditarik). `page.tsx` query tambah `sale_items.id` & `product.is_service`.
  - **psql.exe korup lagi** ("file or directory is corrupted") — migrasi diterapkan via
    `scripts/apply-migration.mjs` (pakai `pg` npm + `SUPABASE_DB_URL`, bungkus begin/commit).
    `tsc` bersih; verifikasi visual tak bisa (di balik login).
  - **Tahap 2 — Tambah baris langsung dari invoice** (migrasi `20260821_add_invoice_item.sql`):
    `add_invoice_item(invoice_id, is_service, product_id, item_name, qty, price,
    warranty_months=12, serial=null)` menautkan penjualan baru **LANGSUNG** ke `invoice_id`
    (bukan lewat `find_or_create_invoice`), jadi bekerja untuk invoice **draft & sent** (asal
    belum lunas). Logika per-item **meniru `create_sale`**: barang → validasi stok, kunci HPP
    (`last_purchase_price`), `stock_movements` sale_out, `client_assets` bila `track_as_asset`;
    jasa → produk generik `'Jasa'` + `item_name`, tanpa stok/aset. `sale_date` = hari terakhir
    periode invoice. UI: tombol **Tambah Baris** di header kartu rincian (hanya belum lunas) →
    dialog pilih Barang/Jasa (`invoice-lines.tsx`), page ambil daftar barang dari
    `v_product_stock` (`is_service=false, is_active`). Guard invoice lunas ditolak di RPC.

- **2026-08-21 — Fitur HUTANG PEMBELIAN (Fase 1 & 2) — audit 5.2.** Menu Pembelian kini
  punya metode bayar **Hutang** (beli tempo, bayar belakangan) selain **Bayar langsung**.
  Berlaku **semua distributor** (bukan cuma Cetak Ide); default metode tetap **Tunai/langsung**.
  Aturan yang berlaku (penting saat menambah fitur terkait):
  - **Model data** (`purchases`): kolom `is_credit`, `due_date`, `paid_date`, `paid_wallet_id`
    (+ Fase 2: `pay_email_sent_at`, `pay_email_sent_to`). `wallet_id` kini **nullable**
    (null untuk hutang). Pembelian lama di-**backfill** `paid_date=purchase_date`.
  - **Prinsip akuntansi:** hutang = kewajiban uang **per-nota** (bukan per-barang) — buku
    terpisah dari **stok** (per-barang) & **piutang** (uang client). **Stok tetap masuk saat
    beli** (barang di tangan); **wallet baru berkurang saat DIBAYAR**. Jadi menjual barang
    tak menyentuh hutang, dan hutang tetap berdiri sampai dilunasi. HPP (`cost_price`) tetap
    terkunci saat beli, tak terpengaruh kapan dibayar.
  - **RPC** (migrasi `20260821_purchase_hutang.sql`): `create_purchase` jadi **8-arg**
    (+`p_is_credit`,`p_due_date`; DROP+CREATE — `create_quick_deal` yang memanggil 6-arg
    tetap jalan lewat DEFAULT). `pay_purchases(ids[], wallet, date)` melunasi **multi-nota**
    sekaligus — **Opsi II: 1 baris `wallet_transactions` expense PER nota** (ref_type
    `purchase`, ref_id=nota), tanggal & wallet sama. Melewati nota bukan-hutang/sudah-lunas.
  - **Bayar** (UI): tab **Hutang** di menu *Piutang & Hutang* — centang nota (atau
    "pilih semua" per distributor) → **Bayar Terpilih** (dialog wallet+tanggal). Kalau
    centang lintas distributor, `pay_purchases` tetap 1 aksi tapi laporan/bukti
    mengelompokkannya **per distributor**.
  - **Laporan kas SINKRON** (aturan wajib bila mengubah laporan): `finance_summary` laba-kas
    memakai **wallet expense ref purchase** (bukan `purchases.total`) → hutang belum bayar
    tak mengurangi kas; `total_purchase` (kartu) tetap aktivitas semua nota. `dashboard_counts`
    +`total_payable`. **Laba Rugi akrual TIDAK berubah** (pembelian→persediaan→HPP saat jual).
    Riwayat Transaksi: baris hutang belum bayar **tak dihitung** (`TxRow.isHutang`,
    `countInTotal=false`) + baris **"Bayar Hutang"** (`source='purchase_payment'`) saat lunas.
  - **Pemeriksaan Data**: **E5 direvisi** → hanya pembelian **lunas** (`paid_date` terisi)
    yang wallet-expense-nya harus = total; **E6 baru** = hutang belum lunas tapi sudah ada
    pengeluaran wallet (anomali). Total **22 cek**.
  - **Fase 2 — Bukti & Email pelunasan** (grouping, tanpa tabel pembayaran): sebuah
    "pembayaran" = nota-nota dengan **distributor+`paid_date`+`paid_wallet_id` sama**.
    Tab **"Riwayat Bayar Hutang"** (tab ke-3): tiap pembayaran punya **Unduh Bukti (PDF)** +
    **Kirim Email**. PDF: `lib/pdf/build-hutang-payment-pdf.ts` + `app/api/hutang-payment/pdf`
    (route `?ids=`), meniru pola `build-invoice-pdf`. Email: `sendHutangPaymentEmail`
    (purchases/actions) pakai ulang `composeEmail`+`sendMail`+`SendEmailDialog`, lampiran PDF,
    tanda tangan Athaya. **Subjek selalu** `Pemberitahuan Pelunasan Hutang — [Distributor] —
    [tanggal]` (opsi B). Isi: daftar nota (INV: Rp…) lalu **Total Dibayarkan**. Kirim
    **manual** (review dulu). `distributors.email` sudah ada (form sudah punya inputnya).
    Penanda terkirim via `mark_hutang_payment_emailed(ids[], to)` (stempel semua nota batch).
  - **Fase 3 (belum):** portal login distributor Cetak Ide (input beli sendiri). Lihat
    memory `cetak-ide-portal-feature`.

- **2026-08-18 — Fix "duplicate key monthly_invoices_user_invoice_no_uniq" saat
  tambah penjualan invoice bulanan.** Menu Penjualan → metode invoice bulanan
  (kejadian nyata: client Rob Peetoom Seminyak) gagal dengan error index unik
  nomor invoice. Penyebab: `create_sale` memanggil `find_or_create_invoice`, dan
  fungsi itu **masih memakai `count(*) + 1`**. Migrasi `20260802_invoice_no_unique.sql`
  dulu **hanya** memperbaiki `generate_monthly_invoice` (dipakai dari menu Invoice),
  sedangkan `find_or_create_invoice` (dipakai dari menu Penjualan) **terlewat**.
  Begitu ada invoice bulan itu dihapus, `count` turun → nomor lama dipakai ulang →
  bentrok. Data nyata Agustus 2026 tersisa `001` & `003` (`002` terhapus),
  `count+1 = 3` → coba `INV/2026/08/003` yang sudah ada → error.
  - Migrasi `20260818_find_or_create_invoice_no_maxplus1.sql`:
    `find_or_create_invoice` di-`CREATE OR REPLACE` (tanda tangan sama) — penomoran
    kini **MAX + 1 lalu loop sampai bebas**, identik dengan `generate_monthly_invoice`.
    Cabang "cari invoice cocok & belum lunas" TIDAK diubah; `create_sale` tak
    disentuh. Nomor bekas invoice terhapus sengaja TIDAK didaur ulang (lubang nomor
    wajar). Diterapkan ke DB produksi via **`pg` (npm)** — `psql.exe` ter-korupsi
    lagi ("file or directory is corrupted"). Diverifikasi nomor Agustus berikutnya
    jadi `004` (bukan `003`).

- **2026-08-18 — Pemulihan file ter-zero + 3 revisi (invoice/penjualan/email).**
  Konteks: user "bersih-bersih data C" meng-**nol-byte-kan** 187 file tracked
  (`src/`, `public/`, `scripts/`, `supabase/migrations/`) — dipulihkan via
  `git checkout -- .` (semua utuh di commit terakhir; `.env.local` & `backups/`
  aman). **`node_modules` DAN cache npm juga ikut corrupt** — reinstall biasa tak
  cukup (npm kira paket sudah ada / cache rusak menghasilkan file tak lengkap).
  Pemulihan tuntas hanya dengan **`npm cache clean --force` + hapus node_modules +
  install ulang**. `tools/pgsql/psql.exe` juga ter-zero → migrasi kini diterapkan
  via **`pg` (npm) + `SUPABASE_DB_URL`** lewat skrip node sementara (bukan psql).
  - **Revisi 1 — hapus invoice bulanan tak kembalikan stok + barang bentrok
    produk jasa.** Migrasi `20260818_purchase_service_match_and_invoice_delete_reverse.sql`:
    (A) `delete_monthly_invoice` dulu hanya **melepas tautan** penjualan
    (`monthly_invoice_id=null`) → stok tak balik; kini **menghapus penjualan
    tergabung + membalik stok/aset/wallet** (meniru `delete_sale`), lalu hapus
    pelunasan & invoice. (B) Halaman Stok Barang baca `v_product_stock`
    (`WHERE is_service=false`) → produk jasa tak pernah tampil; `create_purchase`
    dulu cocokkan nama TANPA cek `is_service`, jadi beli barang bernama sama dgn
    produk jasa (mis. nama layanan maintenance) "nyangkut" ke produk jasa →
    tak tampil di stok. Kini match pembelian hanya ke `is_service=false`. Data
    dicek: **tak ada yang bentrok** (sudah dibersihkan user), jadi fix logika saja.
  - **Revisi 2 — nama JASA custom tampil "Jasa" di invoice bulanan.** `create_sale`
    sudah benar simpan `sale_items.item_name`, tapi penampil invoice hanya ambil
    `product.name` (= produk generik "Jasa"). Diperbaiki di **PDF invoice**
    (`lib/pdf/build-invoice-pdf.ts`) & **tampilan layar** (`invoices/[id]/page.tsx`):
    select tambah `item_name`, render `item_name ?? product.name ?? "-"` (sama
    seperti NOTA `build-sale-pdf.ts` yang sudah benar).
  - **Revisi 3 — kredensial Gmail pindah dari `.env.local` ke DATABASE + UI**
    (Opsi C; user pakai app "full online" via Vercel). Migrasi
    `20260818_email_settings.sql`: tabel `email_settings` (RLS per user) + fungsi
    `save_email_settings`/`get_email_settings`/`reveal_email_password`. Password
    **terenkripsi** pakai pola kredensial eksisting (pgcrypto `pgp_sym_encrypt`,
    kunci `CREDENTIALS_SECRET_KEY`) — sama seperti Network/CCTV/WiFi. `mailer.ts`
    `getConfig()` kini **async**: baca DB dulu → fallback env `GMAIL_*` (mundur-
    kompatibel), `isMailerConfigured()` jadi async (2 pemanggil di
    `invoices/actions.ts` & `sales/actions.ts` di-`await`). UI: tab **Email** baru
    di `/settings` (`settings/email-settings-manager.tsx` + action
    `saveEmailSettings`); App Password write-only (kosongkan = tak diubah).
    ⚠️ Agar jalan di Vercel: **`CREDENTIALS_SECRET_KEY` wajib ada di env Vercel**
    (kunci dekripsi); `GMAIL_*` jadi opsional. Diverifikasi `tsc` bersih + objek DB
    & roundtrip pgcrypto OK; verifikasi visual tak bisa (halaman di balik login).

- **2026-08-06 — Kontrak Maintenance: jatuh tempo akhir bulan + gabung invoice bulanan.**
  Dua keluhan user. (1) Jatuh tempo bawaan kontrak mentok tgl 28 — dropdown
  `DUE_ITEMS` di `maintenance/contract-manager.tsx` sengaja 1..28 karena rumus
  jatuh tempo lama `((periode + 1 bln) + (due_day-1))` bisa **meleset ke bulan
  berikutnya** kalau 31 dipilih untuk bulan pendek (Feb). (2) Kontrak bulanan
  **kadang tak tergabung** dengan invoice bulanan berisi barang → ternyata masalah
  **urutan**: `issue_maintenance_charges` menggabung ke draft periode yang sama,
  tapi `generate_monthly_invoice` **selalu bikin invoice baru** (tak pernah cek
  draft), jadi kalau maintenance terbit dulu lalu barang di-invoice → jadi 2
  invoice terpisah.
  - Migrasi `20260806_maintenance_due_endofmonth_and_invoice_merge.sql`:
    - Constraint `maintenance_contracts_due_day_check` dilonggarkan **0..31**.
      `due_day = 0` = sentinel **"Akhir bulan"**.
    - `issue_maintenance_charges` (`CREATE OR REPLACE`, tanda tangan sama):
      jatuh tempo kini **di-clamp** `LEAST(due_day, hari terakhir bulan target)`;
      `due_day=0` → langsung hari terakhir. Penomoran invoice baru diselaraskan
      ke **MAX+1 + loop** (dulu `count+1`, rawan kembar → ditolak index unik).
    - `generate_monthly_invoice` (`CREATE OR REPLACE`, tanda tangan sama):
      kini **mencari invoice DRAFT** client+periode dulu → kalau ada, **gabung**
      (tautkan sales + hitung ulang total dari SEMUA sales tertaut). Invoice yang
      sudah **sent/paid TIDAK dicari** → tetap dibuatkan invoice terpisah (aman,
      tak mengubah invoice terkirim). Hasilnya perilaku **simetris** — urutan
      terbit maintenance vs barang tak lagi memengaruhi penggabungan.
  - UI (`maintenance/contract-manager.tsx`): `DUE_ITEMS` jadi "Akhir bulan" (value
    `"0"`) + `Tanggal 1..31`; helper `dueDayLabel` menampilkan "Akhir bulan" di
    tabel. **Gotcha**: `handleSave` dulu `toNumber(dueDay) || DEFAULT_DUE_DAY` —
    `0` itu falsy → "Akhir bulan" diam-diam jadi tgl 10; diperbaiki jadi
    `dueDay === "" ? DEFAULT : toNumber(dueDay)`.
  - Diverifikasi `tsc --noEmit` bersih + rumus tanggal diuji via psql
    (31→28 Feb, 31→30 Apr, 31→31 Agu, 0→akhir bulan). Verifikasi visual di app
    tak bisa (halaman di balik login).

- **2026-08-06 — Rapikan UI form Pembelian & Penjualan (daftar barang jadi tabel).**
  User menilai form "Tambah Pembelian" & "Tambah Penjualan" terlalu ribet: tiap
  baris item dibungkus kartu berbingkai tebal, tinggi, plus accordion/baris kedua
  penuh untuk opsi lanjutan → banyak scroll & noise. Perubahan **murni tata letak
  JSX/CSS** — `handleSave`, `createPurchase`/`createSale`, dan seluruh state TIDAK
  disentuh; tak ada field yang dihapus. Alur data & DB identik.
  - **Daftar item jadi tabel padat berkolom** (header `Nama · Qty · Harga ·
    Subtotal` sekali di atas, baris tipis dipisah `divide-y` di dalam satu
    `border rounded-lg` — bukan lagi kartu per item). Subtotal jadi kolom, bukan
    teks per kartu. Qty `text-center`, harga & subtotal `text-right`.
  - **Opsi lanjutan disembunyikan di balik ikon `SlidersHorizontal`** per baris
    (state `Line.showAdv`, ikon menyala `text-primary` saat aktif). Pembelian:
    strip = Harga Jual Default + Garansi. Penjualan: strip = Garansi + Serial
    number (dulu baris kedua penuh). Semua baris tetap bisa buka strip → tak ada
    fitur hilang.
  - **Status stok jadi badge kecil** di sebelah nama: pembelian `stok N` hijau /
    `baru` biru; penjualan `stok N` hijau (merah bila qty > stok) di samping
    `<Select>` barang. Gotcha penjualan: label `productItems` DIUBAH jadi **nama
    saja** (dulu `"nama (stok N)"`) + `SelectTrigger` diberi `w-full min-w-0
    flex-1` supaya nama panjang **truncate** memenuhi kolom, tidak menabrak stok/
    panah. Stok tetap tampil di **dropdown** via `<span>· stok N</span>` di dalam
    `SelectItem` (trigger tetap nama saja karena prop `items` yang menentukan teks
    trigger, bukan isi `SelectItem`).
  - **Footer menempel** (`DialogContent` jadi `flex flex-col p-0`, area tengah
    `flex-1 overflow-y-auto`, `DialogFooter` di-`border-t bg-muted`): Total di kiri
    + Batal/Simpan di kanan, selalu terlihat tanpa scroll. Header juga `border-b`.
  - **Penjualan** tetap membedakan baris jasa (tint biru `bg-sky-50/60` + ikon
    `Wrench`, tanpa strip garansi/serial) dari baris barang; peringatan
    "Stok tidak cukup" jadi baris merah kecil di bawah baris + border-merah pada
    input qty. Panel kondisional **Terhutang** & **Invoice bulanan** dipertahankan,
    dirapikan (ikon `Clock`/`FileText` + field lebih rapat). Tombol "Tambah Barang"
    & "Tambah Jasa" tetap, pindah ke header daftar.
  - File: `src/app/(app)/purchases/purchase-form.tsx`,
    `src/app/(app)/sales/sale-form.tsx`. Diverifikasi `tsc --noEmit` bersih;
    verifikasi visual di app tidak bisa (halaman di balik login).

- **2026-08-03 — Barang HABIS PAKAI (non-aset): flag `products.track_as_asset`.**
  Aturan lama "setiap barang terjual otomatis jadi aset client" salah untuk
  barang habis pakai (kertas QR, stempel, amplop, brosur) yang terlanjur masuk
  daftar Aset Client. User memutuskan barang ini tetap diperlakukan **seperti
  printer** (dibeli via Pembelian → modal, stok tercatat diam-diam, untung &
  HPP dihitung) — SATU-SATUNYA beda: **tidak dibuatkan aset client** (otomatis
  tanpa garansi). Bukan disamakan dengan jasa (jasa modal 0); barang ini punya
  modal nyata dari vendor.
  - Migrasi `20260803_product_track_as_asset.sql`: kolom
    `products.track_as_asset boolean not null default true` (default = perilaku
    lama, semua produk existing tetap aset). `create_sale` di-`CREATE OR REPLACE`
    (tanda tangan sama) — cabang barang kini mengambil `track_as_asset` bersama
    `last_purchase_price`, dan `insert into client_assets` dibungkus
    `if coalesce(v_track_asset, true)`. `stock_movements` & `cost_price` TETAP
    jalan untuk barang non-aset (stok/modal tak berubah).
  - View `v_product_stock` dibuat ulang — halaman produk `select *` dari view
    ini, jadi kolom baru WAJIB di **AKHIR** SELECT (setelah `current_stock`) agar
    `CREATE OR REPLACE VIEW` diterima; tanpa itu `p.track_as_asset` undefined →
    tag "Habis pakai" salah muncul di semua barang.
  - UI: toggle **"Jadikan aset client saat terjual"** di dialog edit produk
    (`products/product-manager.tsx`), default aktif. Daftar produk menampilkan
    penanda **"· Habis pakai"** di subjudul nama untuk `!track_as_asset`. Tipe
    `Product.track_as_asset` (`types/db.ts`) + `ProductInput.track_as_asset`
    (`products/actions.ts`, default `?? true` di `clean()`).
  - Aset yang terlanjur salah (Stempel, Amplop TIP, Brosur Lipat, Kertas QR
    Code) **dihapus manual oleh user**, bukan lewat migrasi.
  - Additive & mundur-kompatibel; form penjualan TIDAK berubah (barang non-aset
    tetap muncul di dropdown & terjual seperti biasa, hanya tak jadi aset).

- **2026-08-02 — Fix nomor invoice KEMBAR setelah ada invoice dihapus.**
  `generate_monthly_invoice` menentukan nomor urut dengan `count(*) + 1` atas
  invoice di bulan yang sama. Begitu satu invoice **dihapus**, count ikut turun
  sehingga nomor yang sudah dipakai diberikan lagi → kembar. Kejadian nyata:
  Juli 2026 invoice 003 & 004 sempat dihapus lalu dibuat ulang; Canggu mengambil
  004, lalu Rob Peetoom School (dibuat 2 Agustus) mendapat **005 yang sudah
  dipakai Rob Peetoom Ubud**.
  Migrasi `20260802_invoice_no_unique.sql`:
  1. Merapikan nomor kembar yang terlanjur ada — yang **paling lama menang**,
     sisanya diberi nomor setelah nomor tertinggi bulan itu (School → 006).
     Keterangan di `wallet_transactions` ikut diperbarui via `replace()` supaya
     akhiran PPh tidak hilang.
  2. Penomoran memakai **MAX + 1** (bukan count), lalu dinaikkan dalam loop
     sampai nomornya benar-benar bebas. Nomor bekas invoice yang dihapus
     **sengaja TIDAK dipakai ulang** — nomor invoice tidak boleh didaur ulang,
     jadi lubang nomor (mis. 003) memang wajar dan dibiarkan.
  3. Indeks unik `monthly_invoices_user_invoice_no_uniq (user_id, invoice_no)`
     sebagai pengaman terakhir — sudah diuji menolak duplikat.
  Aman dilakukan karena kedua invoice 005 **belum pernah dikirim email**
  (`email_sent_at` null) — selalu cek kolom itu dulu sebelum menomori ulang.

- **2026-08-02 — Laporan Keuangan: Laba Rugi, Analisa Margin, PPh 23, export Excel+PDF.**
  Berangkat dari workbook Excel rekonsiliasi milik user (`Opening_Balance_Wallet_ERP.xlsx`)
  yang ingin dijadikan menu aplikasi. Temuan utama: `finance_summary` (laba lama)
  berbasis KAS dan salah secara akuntansi — pembelian barang yang **belum terjual**
  dihitung biaya, dan **uang muka proyek** dihitung pendapatan. Untuk Juli 2026 laba
  lama menunjukkan **9.069.259**, sedangkan laporan baru **5.898.380** — cocok dengan
  Excel user (5.898.025, beda 355 dari beda kategori pengeluaran).
  - **Modul bersama** `src/lib/reports/{profit-loss,margin,transactions}.ts` dipakai
    bertiga oleh halaman, route Excel, dan route PDF → angka layar = angka file.
    Tipe di `src/types/reports.ts`, helper Excel di `lib/reports/export-helpers.ts`,
    gaya PDF di `lib/pdf/report-kit.tsx`.
  - **Laba Rugi** (tab baru di `/reports`): A. Pendapatan Usaha · B. HPP (memakai
    `sale_items.cost_price` = modal barang yang BENAR-BENAR terjual, bukan total
    pembelian) · Laba Kotor + Margin · C. Biaya Operasional (+ Pengeluaran Pribadi
    + **Pajak PPh 23**) · **LABA BERSIH** · D. **Proyek Berjalan** (status ≠ `done`,
    labanya TIDAK diakui — ditampilkan ukuran normal, bukan catatan kecil, atas
    permintaan user) · E. Persediaan (aset). Proyek `done` diakui sebagai pendapatan
    + biayanya masuk HPP. **Jadi status RAB yang menentukan** — ubah status ke
    "Berjalan" bila belum selesai.
  - **Analisa Margin**: per item dari `sale_items` + proyek **status `done` saja**.
    Baris jasa modal 0 → margin 100% (sama seperti Excel).
  - **PPh 23 (migrasi `20260802_invoice_pph23.sql`)**: kolom `pph_base/pph_rate/
    pph_amount` di `monthly_invoices`; `mark_invoice_paid` dapat 2 parameter baru
    **di akhir dengan default** (pemanggilan lama 3-argumen tetap jalan) dan kini
    memasukkan **NETTO** ke wallet → saldo tetap cocok mutasi bank. Fungsi
    `invoice_service_base(uuid)` menghitung dasar kena pajak otomatis = Σ baris
    **jasa** (`products.is_service`) — memanfaatkan flag dari fitur jual JASA;
    hasilnya cocok persis dengan Excel user (Ubud 2.350.000, School 0, dst).
    **PDF invoice TIDAK berubah** (tetap ditagih bruto). User memilih **Opsi B**:
    PPh dicatat sebagai BIAYA bertanda "Pajak PPh 23", bukan aset kredit pajak.
    View `v_monthly_invoices` dibuat ulang — kolom baru WAJIB di akhir SELECT.
  - **Riwayat Transaksi**: kini juga menampilkan **pelunasan invoice** (netto) dan
    **termin + biaya proyek RAB untuk proyek `done` saja**. ⚠️ **Gotcha dobel-hitung**:
    penjualan metode `monthly_invoice` sudah tampil sebagai baris penjualan, jadi
    baris pelunasan invoice akan menghitung uang yang sama dua kali. Diatasi dengan
    field `TxRow.countInTotal` — baris penjualan invoice tetap TAMPIL (rincian
    terlihat) tapi **tidak dijumlahkan**; yang dijumlahkan baris pelunasannya.
    Kolom **saldo berjalan sengaja TIDAK dibuat** (dibatalkan user: sulit
    penempatannya, dan hanya valid bila difilter satu wallet).
  - **Export**: satu tombol `ReportDownload` (dropdown Excel/PDF) per laporan —
    bukan 2 tombol terpisah, karena 3 laporan × 2 format = 6 tombol terlalu penuh.
    Route `/api/reports/{profit-loss,margin,transactions}?from=&to=&format=`.
    Excel memakai **rumus** (SUM/IFERROR), bukan angka mati, agar sheet tetap hidup.

- **2026-08-02 — Fitur jual JASA (tanpa modal/stok) di form Penjualan.**
  Kasus nyata: "install ulang laptop Rp100.000, tanpa modal". Sebelumnya tak bisa
  dicatat — form penjualan hanya menjual produk (validasi stok memblokir stok 0),
  dan menu Pembelian tak menerima Rp 0 (memang jasa TAK boleh lewat pembelian).
  - **Form** (`sales/sale-form.tsx`): tiap baris kini `kind: "product" | "service"`.
    Tombol **"Tambah Jasa"** di samping "Tambah Barang". Baris jasa = **nama bebas
    + qty + harga**, tanpa dropdown produk / garansi / serial. Validasi stok hanya
    untuk baris barang. Bisa **campur barang + jasa dalam satu nota**. Dropdown
    barang memfilter `!is_service` agar produk generik "Jasa" tak muncul.
  - **DB** (migrasi `20260802_sale_service_line.sql`): kolom `sale_items.item_name`
    (nama jasa bebas; barang = null). `create_sale` di-`CREATE OR REPLACE` (tanda
    tangan sama) — item jsonb bisa `{ is_service:true, name, qty, price }`: **lewati
    validasi stok, stock_movements, & client_assets**; `cost_price=0`; `product_id`
    diarahkan ke satu produk generik `find_or_create_service_product('Jasa')`
    (is_service=true) supaya katalog barang tak terkotori. Diterapkan via psql
    (`PGSSLMODE=require`) → `ALTER TABLE` + `CREATE FUNCTION` sukses.
  - **NOTA** (`lib/pdf/build-sale-pdf.ts`): select tambah `item_name`; nama baris =
    `item_name ?? product.name ?? "-"`. Kolom NOTA (nama/qty/harga/subtotal) memang
    tanpa garansi/serial, jadi jasa langsung pas.
  - **Action** (`sales/actions.ts`): `SaleItemInput` jadi union barang|jasa; filter
    `valid` diperbaiki agar baris jasa (`is_service && name && qty>0`) tak dibuang
    (sebelumnya syaratnya `product_id` → jasa selalu terbuang).
  - **Type** (`types/db.ts`): `Product` diberi `is_service: boolean`.
  - Semua metode bayar (cash/transfer/terhutang/monthly_invoice) berlaku untuk jasa.
    Additive & mundur-kompatibel: penjualan barang lama tak berubah, `item_name` null.

- **2026-07-30 — Fitur "Kirim via Gmail" (invoice bulanan & NOTA penjualan).**
  Tombol kirim PDF langsung ke email client via Gmail SMTP (nodemailer), dengan
  dialog subject/isi yang bisa diedit + tombol "Lihat PDF" + pratinjau lampiran.
  - **Pengirim**: akun khusus `athaya.it@gmail.com` (BUKAN email pribadi), nama
    tampil "Agusta Sigit IT" (nama pemilik lebih dikenal client). Tanda tangan di
    badan email juga "Agusta Sigit IT". Kredensial di `.env.local`: `GMAIL_USER`,
    `GMAIL_APP_PASSWORD` (App Password 16 karakter — WAJIB diisi user, butuh
    2-Step Verification aktif), `GMAIL_FROM_NAME`. Tanpa `GMAIL_APP_PASSWORD`
    terisi, action menolak dengan pesan jelas.
  - **Subject invoice**: `INVOICE <BULAN PERIODE>` — ikut bulan *periode* invoice
    (`period_month`), BUKAN bulan saat dikirim, agar tidak membingungkan client.
  - **Penjualan**: tombol kirim hanya untuk metode `cash`/`transfer`/`terhutang`
    yang sudah lunas (sama dgn syarat unduh NOTA); `terhutang` belum lunas &
    `monthly_invoice` disembunyikan. Subject `NOTA PENJUALAN — <client> — <tgl>`.
  - **Jejak kirim**: kolom `email_sent_at`/`email_sent_to` di `monthly_invoices`
    & `sales` (migrasi `20260730_email_sent_status.sql`, view `v_monthly_invoices`
    dibuat ulang — kolom baru WAJIB di akhir SELECT agar `CREATE OR REPLACE VIEW`
    diterima). Mengirim invoice draft otomatis set status `sent`.
  - **Arsitektur**: builder PDF diekstrak ke `src/lib/pdf/build-{invoice,sale}-pdf.ts`
    (dipakai bersama route unduh & action email → isi/nama file identik). Mailer di
    `src/lib/email/mailer.ts`. Dialog reusable `src/components/shared/send-email-dialog.tsx`.
  - **Gotcha SMTP**: JANGAN pakai preset `service:"gmail"` (default port 465/TLS
    implisit) — di jaringan ini port 465 time-out. Mailer memakai host eksplisit
    `smtp.gmail.com:587` `secure:false` `requireTLS:true` (STARTTLS) → berhasil.
    Diuji nyata 2026-07-30: `250 OK`, email + lampiran diterima. Perubahan env
    (App Password) baru terbaca setelah dev server di-restart.
  - **Tanda tangan HTML berlogo** (lanjutan, 2026-07-30): email dikirim sebagai
    **HTML** (bukan teks polos) dengan blok tanda tangan otomatis di bawah isi —
    logo `public/email-logo.png` ditanam **inline via CID** (`cid:athaya-logo`,
    tampil di Gmail tanpa link eksternal) + kontak Athaya Computer (A/P/M/E/W).
    Modul `src/lib/email/signature.ts` → `composeEmail(body)` mengembalikan
    `{ html, text, attachments(logo) }`; dipakai kedua action, digabung dengan
    lampiran PDF. `mailer.sendMail` kini menerima field `html`. Baris penutup
    "Hormat kami, …" DIHAPUS dari isi default (identitas cukup dari blok tanda
    tangan). Logo diproses via `sharp` (trim + resize lebar 200px, PNG). Kalau
    file logo tak ada, tanda tangan tetap terkirim tanpa `<img>` (tidak error).
- **2026-07-28 — Fix menu akun (email pojok kanan) → "404"/menu logout tak muncul.**
  Dua bug di dropdown akun `src/components/shared/app-header.tsx`:
  1. `DropdownMenuLabel` (di `src/components/ui/dropdown-menu.tsx`) dirender pakai
     `Menu.GroupLabel`, yang **wajib** berada di dalam `Menu.Group`. Label email
     dipakai berdiri sendiri → saat menu dibuka Base UI melempar
     `MenuGroupContext is missing` → popup gagal render (di production tampak
     seperti halaman 404). Diubah: `DropdownMenuLabel` sekarang `<div>` biasa
     (sesuai konvensi shadcn, label boleh mandiri).
  2. Item aksi memakai `onSelect` (pola Radix). Base UI `Menu.Item` **tidak punya**
     `onSelect` — yang tersedia `onClick`. `onSelect` lolos TypeScript karena
     `<div>` punya event bawaan `onSelect` (seleksi teks), jadi handler tak pernah
     jalan saat diklik. Diubah ke `onClick={() => logout()}`.
- **2026-07-11 — Fix nested `<button>` hydration error.** Beberapa komponen ditulis
  dengan `asChild` (pola Radix) sehingga trigger merender `<button>`-nya sendiri
  membungkus `<Button>` anak → button tersarang. Diubah ke prop `render`:
  `src/components/shared/app-header.tsx` (SheetTrigger + DropdownMenuTrigger),
  `src/app/(app)/products/product-manager.tsx` (Button→Link riwayat stok),
  `src/app/(app)/products/[id]/page.tsx` (Button→Link kembali). Untuk Button yang
  dirender sebagai `<Link>` ditambahkan `nativeButton={false}`.
- **2026-07-11 — Fix Select menampilkan value mentah (UUID/kode).** Semua `<Select>`
  belum mengoper prop `items`, sehingga trigger menampilkan UUID/`cash`/`all`
  alih-alih label (mis. field "Dari" di Transfer Antar Wallet menampilkan UUID).
  Ditambahkan `items` + normalisasi `onValueChange` (`v ?? ...`) di:
  `wallets/wallet-manager.tsx`, `products/product-manager.tsx`,
  `clients/client-manager.tsx`, `(app)/settings/category-manager.tsx`.
- **2026-07-11 — Fix Select "uncontrolled→controlled" + saldo wallet jadi UUID.**
  Form Phase 3 memakai `value={x || undefined}` sehingga render pertama uncontrolled
  lalu controlled (console error di `purchases/page.tsx`), dan trigger menampilkan
  UUID. Diganti ke `value={x || null}` + ditambah prop `items` di:
  `purchases/purchase-form.tsx`, `sales/sale-form.tsx`,
  `components/shared/expense-manager.tsx`, plus category select di
  `products/product-manager.tsx` & `clients/client-manager.tsx`.
