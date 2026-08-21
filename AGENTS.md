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
