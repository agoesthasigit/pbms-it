# MASTER PROMPT — Personal Business Management System IT (PBMS-IT)

> Dokumen ini adalah **satu-satunya sumber kebenaran (single source of truth)** untuk pengembangan aplikasi.
> Berikan dokumen ini kepada AI di awal setiap sesi pengerjaan, lalu sebutkan checkpoint terakhir Anda
> (contoh: "Lanjutkan dari CHECKPOINT 3.2"). AI wajib mengikuti semua aturan di dokumen ini.

---

## 1. IDENTITAS PROYEK

| Item | Keterangan |
|---|---|
| Nama Proyek | Personal Business Management System IT (PBMS-IT) |
| Tipe Aplikasi | Progressive Web App (PWA), single-user (admin/pribadi) |
| Tech Stack | Next.js 14+ (App Router) · Supabase (PostgreSQL + Auth + RLS) · Vercel (hosting) · Tailwind CSS · shadcn/ui |
| Bahasa UI | Indonesia |
| Mata Uang | IDR (Rupiah), format: Rp 1.250.000 |
| Zona Waktu | Asia/Jakarta (WIB) |

## 2. LATAR BELAKANG & TUJUAN

Pemilik adalah teknisi/kontraktor IT yang menangani banyak client (villa, kantor, hotel, sekolah, toko).
Masalah: data penjualan, pembelian, garansi, credentials network, dan keuangan tersebar & berantakan.
Tujuan: mengubah data berantakan menjadi informasi jelas, real-time, dalam satu aplikasi pribadi.

Prinsip desain:
1. **Wallet-centric ledger** — semua uang masuk/keluar tercatat sebagai transaksi wallet. Saldo = hasil hitung, bukan angka manual.
2. **Stock movement ledger** — stok berubah hanya lewat pergerakan tercatat (pembelian, penjualan, penyesuaian).
3. **Computed status** — status garansi & invoice dihitung real-time dari tanggal, tidak disimpan statis.
4. **Client 360** — semua data (asset, credentials, CCTV, RAB, profit) bisa dilihat per client dalam satu halaman.
5. **Single user** — hanya 1 akun admin. Semua tabel dilindungi RLS `user_id = auth.uid()`.

## 3. FITUR LENGKAP

### 3.1 Autentikasi
- Login email + password (Supabase Auth). Tidak ada halaman registrasi publik (akun dibuat manual via Supabase dashboard).
- Session persistent, auto-refresh token, redirect ke /login jika belum login (middleware).

### 3.2 Wallet (Kantong Dompet)
- CRUD wallet (contoh: Kas Tunai, BCA, Dana). Field: nama, tipe (cash/bank/e-wallet), saldo awal, aktif/nonaktif.
- Saldo = saldo awal + Σ pemasukan − Σ pengeluaran (dihitung dari `wallet_transactions`).
- Transfer antar wallet (membuat 2 transaksi: transfer_out & transfer_in).
- Semua modul keuangan (penjualan tunai, pelunasan invoice, pembelian, pengeluaran operasional, pengeluaran pribadi) WAJIB memilih wallet.

### 3.3 Dashboard
Kartu ringkasan (filter periode: bulan ini / bulan lalu / tahun ini / custom):
- Total pemasukan, total pengeluaran operasional, total pengeluaran pribadi, laba bersih.
- Jumlah client aktif, jumlah invoice pending (belum lunas), jumlah garansi habis < 30 hari.
Widget:
- Grafik tren keuangan (pemasukan vs pengeluaran per bulan, 12 bulan terakhir).
- Daftar invoice tertunda (client, periode, nominal, umur tagihan).
- Daftar peringatan garansi akan habis ≤ 30 hari (client, barang, tanggal habis, sisa hari).

### 3.4 Data Client
- Field: nama perusahaan, nama client (PIC), kategori (dinamis dari tabel categories), email, alamat, no telpon, status (aktif/nonaktif), tanggal bergabung, catatan.
- Fitur: cari, filter kategori/status, CRUD, link ke halaman Client 360.

### 3.5 Data Distributor
- Field: nama distributor, nama kontak, telepon, email, alamat, catatan. CRUD + pencarian.

### 3.6 Stock Barang (Produk)
- Field: nama barang, SKU (opsional), kategori produk, satuan, harga beli terakhir, harga jual default, stok saat ini (computed dari movements), stok minimum, default masa garansi (bulan).
- Peringatan visual jika stok ≤ stok minimum.
- Riwayat pergerakan stok per barang (masuk/keluar/penyesuaian, tanggal, referensi).
- Penyesuaian stok manual (stock opname) dengan catatan alasan.

### 3.7 Pembelian Barang
- Header: distributor, tanggal, no. nota (opsional), wallet pembayar, catatan.
- Item (bisa multi-item): barang, qty, harga beli. Total otomatis.
- Efek otomatis saat disimpan: stok bertambah (movement IN), transaksi wallet keluar (expense), harga beli terakhir produk ter-update.

### 3.8 Penjualan Barang
- Header: client, tanggal, metode bayar (**tunai** / **invoice bulanan**), wallet (wajib jika tunai), catatan.
- Item (multi-item): barang, qty, harga jual, masa garansi (bulan, default dari produk, bisa diubah), serial number (opsional).
- Efek otomatis saat disimpan:
  1. Stok berkurang (movement OUT). Validasi: qty ≤ stok tersedia.
  2. Setiap item otomatis menjadi **asset client** (tgl beli = tgl penjualan, tgl garansi berakhir = tgl + masa garansi).
  3. Jika tunai → transaksi wallet masuk (income) saat itu juga.
  4. Jika invoice bulanan → penjualan berstatus piutang, menunggu digabung ke invoice bulanan.

### 3.9 Pengeluaran Operasional & 3.10 Pengeluaran Pribadi
- Dua modul terpisah, struktur sama: tanggal, kategori (dinamis), nominal, wallet, keterangan, label (opsional).
- Efek: transaksi wallet keluar. Pengeluaran pribadi TIDAK mengurangi laba bersih bisnis, hanya mengurangi saldo wallet (aturan bisnis penting!).

### 3.11 Asset Client
- Sumber: otomatis dari penjualan + bisa input manual (barang lama sebelum pakai aplikasi).
- Field: client, nama barang, serial number, tgl beli, tgl garansi berakhir, catatan.
- Status garansi (computed real-time): `Aktif` (> 30 hari), `Akan Habis` (≤ 30 hari), `Habis` (lewat).
- Log perbaikan per asset: tanggal, deskripsi masalah, tindakan, biaya (opsional, jika ada biaya → bisa dicatat sebagai pemasukan servis atau pengeluaran operasional), teknisi/catatan.

### 3.12 Invoice Bulanan
- Sistem mengumpulkan semua penjualan bermetode "invoice bulanan" yang belum ditagih, dikelompokkan per client per periode (bulan).
- Aksi "Buat Invoice": pilih client + periode → sistem menarik semua penjualan piutang client tsb pada periode itu → jadi 1 invoice (nomor otomatis: INV/YYYY/MM/###).
- Status invoice: `draft` → `terkirim` → `lunas` (atau `jatuh tempo` jika lewat due date).
- Saat "Tandai Lunas": pilih wallet + tanggal bayar → transaksi wallet masuk (income) sebesar total invoice.
- Export/download PDF invoice (kop identitas usaha, data client, tabel item, total, terbilang, tanda tangan).

### 3.13 Credentials Network Client
- Per client bisa banyak entri. Field: nama WiFi (SSID), username, **password (terenkripsi)**, nama alat/perangkat (merk router/AP), IP address (opsional), lokasi pemasangan, catatan.
- Password disembunyikan default, tombol show/hide + copy.
- Log perbaikan network per entri: tanggal, masalah, tindakan, catatan.

### 3.14 CCTV Client
- Per client bisa banyak entri. Field: merk NVR/DVR, jumlah channel, username, **password (terenkripsi)**, IP/alamat akses (opsional), lokasi, catatan.
- Log perbaikan CCTV per entri (struktur sama dengan network).

### 3.15 Rencana Anggaran Biaya (RAB)
- Header: client, nama proyek, tanggal, status (draft/berjalan/selesai), catatan.
- **Detail RAB** (penawaran): baris dinamis (nama barang, qty, harga, total = qty×harga). Grand Total RAB otomatis.
- **Detail Pengeluaran** (realisasi): baris dinamis sama. Grand Total Pengeluaran otomatis.
- **LABA BERSIH = Grand Total RAB − Grand Total Pengeluaran** (tampil besar di bawah, hijau jika positif, merah jika negatif).
- Export/cetak PDF (kop, info proyek, tabel RAB, tabel pengeluaran, laba).
- Opsional: tombol "Catat Laba ke Wallet" saat proyek selesai (income ke wallet pilihan).

### 3.16 Laporan Keuangan
- Filter periode. Menampilkan: total pendapatan, total pengeluaran (operasional), laba bersih, margin laba % (= laba/pendapatan×100).
- Grafik: tren pendapatan vs pengeluaran per bulan, laba bersih per bulan.
- Tabel rincian pemasukan (per sumber: penjualan tunai, pelunasan invoice, laba RAB, servis, lainnya).
- Tabel rincian pengeluaran (per kategori operasional).
- Catatan: pengeluaran pribadi ditampilkan terpisah sebagai informasi, TIDAK masuk perhitungan laba bisnis.

### 3.17 Kategori & Label Dinamis
- Satu halaman pengaturan: CRUD kategori dengan tipe (kategori client / kategori produk / kategori pengeluaran operasional / kategori pengeluaran pribadi / sumber pemasukan) dan CRUD label bebas.
- Kategori yang sudah dipakai transaksi tidak boleh dihapus (soft-protect), hanya bisa dinonaktifkan.

### 3.18 Client 360 (History Client)
Halaman ringkasan per client, berisi tab/section:
1. Profil client + statistik (total pembelian, total dibayar, piutang berjalan).
2. Asset client (+ status garansi).
3. Credentials network.
4. CCTV.
5. RAB/proyek client (+ laba per proyek).
6. Invoice bulanan client (riwayat + status).
7. Profit dari client per bulan (grafik/tabel).
8. Gabungan log perbaikan (asset + network + CCTV) urut tanggal.

## 4. ATURAN BISNIS (BUSINESS RULES) — WAJIB DIIKUTI

- BR-01: Saldo wallet TIDAK PERNAH di-update manual; selalu computed dari `initial_balance + Σ transactions`.
- BR-02: Setiap uang masuk/keluar wajib punya baris di `wallet_transactions` dengan referensi sumber (ref_type + ref_id).
- BR-03: Stok produk hanya berubah lewat `stock_movements` (purchase_in, sale_out, adjustment).
- BR-04: Penjualan tidak boleh disimpan jika qty > stok tersedia.
- BR-05: Setiap sale_item otomatis membuat 1 baris `client_assets` (garansi = tgl jual + warranty_months).
- BR-06: Penjualan tunai → income wallet langsung. Penjualan invoice bulanan → income wallet HANYA saat invoice ditandai lunas.
- BR-07: Satu penjualan piutang hanya boleh masuk ke SATU invoice bulanan.
- BR-08: Laba bersih bisnis = pemasukan bisnis − pengeluaran operasional − HPP (opsional fase lanjut). Pengeluaran pribadi TIDAK dihitung.
- BR-09: Status garansi computed: habis jika `warranty_end < today`; akan habis jika `≤ today+30 hari`; selain itu aktif.
- BR-10: Password network & CCTV disimpan terenkripsi (pgcrypto `pgp_sym_encrypt`), didekripsi hanya saat diminta via RPC.
- BR-11: Semua tabel punya `user_id` + RLS `auth.uid() = user_id`. Tidak ada data publik.
- BR-12: Semua penghapusan data transaksi keuangan harus membalikkan efeknya (hapus penjualan → stok kembali, transaksi wallet terhapus, asset terhapus) — gunakan transaksi database / cascade yang benar.
- BR-13: Nomor invoice otomatis format `INV/YYYY/MM/NNN`, urut per bulan.
- BR-14: Format tampilan uang: Rp dengan pemisah titik ribuan, tanpa desimal.

---

## 5. SKEMA DATABASE (SQL SIAP PAKAI — jalankan di Supabase SQL Editor)

```sql
-- ============ EXTENSIONS ============
create extension if not exists pgcrypto;

-- ============ ENUMS ============
create type wallet_type as enum ('cash','bank','ewallet');
create type tx_type as enum ('income','expense','transfer_in','transfer_out');
create type client_status as enum ('active','inactive');
create type payment_method as enum ('cash','monthly_invoice');
create type invoice_status as enum ('draft','sent','paid','overdue');
create type movement_type as enum ('purchase_in','sale_out','adjustment');
create type rab_status as enum ('draft','ongoing','done');
create type rab_item_type as enum ('budget','expense');
create type category_type as enum ('client','product','operational_expense','personal_expense','income_source');
create type repair_target as enum ('asset','network','cctv');

-- ============ KATEGORI & LABEL ============
create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  type category_type not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table labels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  color text default '#6366f1',
  created_at timestamptz not null default now()
);

-- ============ WALLET ============
create table wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  type wallet_type not null default 'cash',
  initial_balance numeric(15,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  wallet_id uuid not null references wallets(id) on delete cascade,
  type tx_type not null,
  amount numeric(15,2) not null check (amount >= 0),
  tx_date date not null default current_date,
  ref_type text,          -- 'sale' | 'purchase' | 'invoice' | 'op_expense' | 'personal_expense' | 'transfer' | 'rab' | 'repair' | 'manual'
  ref_id uuid,
  description text,
  created_at timestamptz not null default now()
);
create index idx_wtx_wallet on wallet_transactions(wallet_id, tx_date);
create index idx_wtx_ref on wallet_transactions(ref_type, ref_id);

-- Saldo wallet (VIEW — BR-01)
create or replace view v_wallet_balances as
select w.id, w.name, w.type, w.is_active,
  w.initial_balance
  + coalesce(sum(case when t.type in ('income','transfer_in') then t.amount
                      when t.type in ('expense','transfer_out') then -t.amount end),0) as balance
from wallets w
left join wallet_transactions t on t.wallet_id = w.id
group by w.id;

-- ============ CLIENT & DISTRIBUTOR ============
create table clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  company_name text not null,
  contact_name text,
  category_id uuid references categories(id),
  email text,
  address text,
  phone text,
  status client_status not null default 'active',
  joined_date date default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create table distributors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  contact_name text,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

-- ============ PRODUK & STOK ============
create table products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  sku text,
  category_id uuid references categories(id),
  unit text not null default 'pcs',
  last_purchase_price numeric(15,2) default 0,
  default_selling_price numeric(15,2) default 0,
  min_stock int not null default 0,
  default_warranty_months int not null default 12,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  product_id uuid not null references products(id) on delete cascade,
  type movement_type not null,
  qty int not null,               -- positif = masuk, negatif = keluar
  ref_type text, ref_id uuid,
  note text,
  created_at timestamptz not null default now()
);
create index idx_sm_product on stock_movements(product_id);

-- Stok saat ini (VIEW — BR-03)
create or replace view v_product_stock as
select p.*, coalesce(sum(m.qty),0)::int as current_stock
from products p left join stock_movements m on m.product_id = p.id
group by p.id;

-- ============ PEMBELIAN ============
create table purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  distributor_id uuid references distributors(id),
  wallet_id uuid not null references wallets(id),
  purchase_date date not null default current_date,
  invoice_no text,
  total numeric(15,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table purchase_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  purchase_id uuid not null references purchases(id) on delete cascade,
  product_id uuid not null references products(id),
  qty int not null check (qty > 0),
  price numeric(15,2) not null,
  subtotal numeric(15,2) generated always as (qty * price) stored
);

-- ============ PENJUALAN ============
create table sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  client_id uuid not null references clients(id),
  wallet_id uuid references wallets(id),   -- wajib jika cash
  sale_date date not null default current_date,
  payment_method payment_method not null default 'cash',
  total numeric(15,2) not null default 0,
  monthly_invoice_id uuid,                 -- diisi saat masuk invoice (BR-07)
  notes text,
  created_at timestamptz not null default now()
);
create index idx_sales_client on sales(client_id, sale_date);

create table sale_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  sale_id uuid not null references sales(id) on delete cascade,
  product_id uuid not null references products(id),
  qty int not null check (qty > 0),
  price numeric(15,2) not null,
  warranty_months int not null default 12,
  serial_number text,
  subtotal numeric(15,2) generated always as (qty * price) stored
);

-- ============ ASSET CLIENT ============
create table client_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  client_id uuid not null references clients(id) on delete cascade,
  sale_item_id uuid references sale_items(id) on delete set null,
  product_name text not null,
  serial_number text,
  purchase_date date not null,
  warranty_end date not null,
  notes text,
  created_at timestamptz not null default now()
);

-- Status garansi computed (BR-09)
create or replace view v_client_assets as
select a.*, c.company_name,
  case when a.warranty_end < current_date then 'expired'
       when a.warranty_end <= current_date + 30 then 'expiring'
       else 'active' end as warranty_status,
  (a.warranty_end - current_date) as days_left
from client_assets a join clients c on c.id = a.client_id;

-- ============ LOG PERBAIKAN (asset / network / cctv) ============
create table repair_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  target repair_target not null,
  target_id uuid not null,           -- id asset / network / cctv
  client_id uuid not null references clients(id) on delete cascade,
  repair_date date not null default current_date,
  problem text not null,
  action_taken text,
  cost numeric(15,2) default 0,
  notes text,
  created_at timestamptz not null default now()
);
create index idx_repair_target on repair_logs(target, target_id);

-- ============ INVOICE BULANAN ============
create table monthly_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  client_id uuid not null references clients(id),
  invoice_no text not null,          -- INV/YYYY/MM/NNN (BR-13)
  period_month date not null,        -- tanggal 1 bulan periode
  status invoice_status not null default 'draft',
  total numeric(15,2) not null default 0,
  due_date date,
  paid_date date,
  paid_wallet_id uuid references wallets(id),
  notes text,
  created_at timestamptz not null default now()
);
alter table sales add constraint fk_sales_invoice
  foreign key (monthly_invoice_id) references monthly_invoices(id) on delete set null;

-- ============ PENGELUARAN ============
create table operational_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  wallet_id uuid not null references wallets(id),
  category_id uuid references categories(id),
  label_id uuid references labels(id),
  expense_date date not null default current_date,
  amount numeric(15,2) not null check (amount > 0),
  description text,
  created_at timestamptz not null default now()
);

create table personal_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  wallet_id uuid not null references wallets(id),
  category_id uuid references categories(id),
  label_id uuid references labels(id),
  expense_date date not null default current_date,
  amount numeric(15,2) not null check (amount > 0),
  description text,
  created_at timestamptz not null default now()
);

-- ============ CREDENTIALS NETWORK & CCTV (password terenkripsi — BR-10) ============
create table network_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  client_id uuid not null references clients(id) on delete cascade,
  ssid text not null,
  username text,
  password_enc bytea,                -- pgp_sym_encrypt
  device_name text,
  ip_address text,
  location text,
  notes text,
  created_at timestamptz not null default now()
);

create table cctv_systems (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  client_id uuid not null references clients(id) on delete cascade,
  nvr_brand text not null,
  channel_count int not null default 4,
  username text,
  password_enc bytea,
  ip_address text,
  location text,
  notes text,
  created_at timestamptz not null default now()
);

-- RPC enkripsi/dekripsi (key disimpan sebagai Supabase secret, dipanggil dari server saja)
create or replace function encrypt_secret(p_plain text, p_key text)
returns bytea language sql security definer
as $$ select pgp_sym_encrypt(p_plain, p_key) $$;

create or replace function decrypt_secret(p_enc bytea, p_key text)
returns text language sql security definer
as $$ select pgp_sym_decrypt(p_enc, p_key) $$;

-- ============ RAB ============
create table rab_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  client_id uuid not null references clients(id),
  project_name text not null,
  project_date date not null default current_date,
  status rab_status not null default 'draft',
  notes text,
  created_at timestamptz not null default now()
);

create table rab_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  rab_id uuid not null references rab_projects(id) on delete cascade,
  item_type rab_item_type not null,   -- 'budget' (RAB) | 'expense' (realisasi)
  item_name text not null,
  qty numeric(10,2) not null default 1,
  price numeric(15,2) not null default 0,
  total numeric(15,2) generated always as (qty * price) stored,
  sort_order int not null default 0
);

-- Ringkasan laba RAB (BR: laba = ΣRAB − Σpengeluaran)
create or replace view v_rab_summary as
select r.*, c.company_name,
  coalesce(sum(i.total) filter (where i.item_type='budget'),0)  as grand_total_rab,
  coalesce(sum(i.total) filter (where i.item_type='expense'),0) as grand_total_expense,
  coalesce(sum(i.total) filter (where i.item_type='budget'),0)
  - coalesce(sum(i.total) filter (where i.item_type='expense'),0) as net_profit
from rab_projects r
join clients c on c.id = r.client_id
left join rab_items i on i.rab_id = r.id
group by r.id, c.company_name;

-- ============ RLS (BR-11) — pola sama untuk SEMUA tabel ============
do $$
declare t text;
begin
  foreach t in array array[
    'categories','labels','wallets','wallet_transactions','clients','distributors',
    'products','stock_movements','purchases','purchase_items','sales','sale_items',
    'client_assets','repair_logs','monthly_invoices','operational_expenses',
    'personal_expenses','network_credentials','cctv_systems','rab_projects','rab_items'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "owner_all_%s" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t, t);
  end loop;
end $$;
```

### 5.1 Relasi Kunci (ERD ringkas)
```
wallets 1─* wallet_transactions
clients 1─* sales 1─* sale_items *─1 products
clients 1─* client_assets (dibuat otomatis dari sale_items)
clients 1─* network_credentials / cctv_systems / rab_projects / monthly_invoices
distributors 1─* purchases 1─* purchase_items *─1 products
products 1─* stock_movements
rab_projects 1─* rab_items (type: budget | expense)
repair_logs → polymorphic ke asset / network / cctv
monthly_invoices 1─* sales (sales.monthly_invoice_id)
```

---

## 6. STRUKTUR PROYEK & KONVENSI KODE

```
src/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (app)/                    # layout dengan sidebar, protected
│   │   ├── dashboard/
│   │   ├── wallets/
│   │   ├── clients/  clients/[id]/   # [id] = Client 360
│   │   ├── distributors/
│   │   ├── products/             # stock barang
│   │   ├── purchases/
│   │   ├── sales/
│   │   ├── expenses/operational/  expenses/personal/
│   │   ├── assets/
│   │   ├── invoices/
│   │   ├── network/  cctv/
│   │   ├── rab/  rab/[id]/
│   │   ├── reports/
│   │   └── settings/             # kategori & label
│   ├── api/                      # route handlers (PDF, decrypt password)
│   ├── layout.tsx  manifest.ts   # PWA manifest
├── components/ui/                # shadcn/ui
├── components/shared/            # DataTable, MoneyInput, StatCard, dll
├── lib/supabase/ (client.ts, server.ts, middleware.ts)
├── lib/utils/ (currency.ts, date.ts)
└── types/database.ts             # hasil supabase gen types
```

Konvensi wajib:
- TypeScript strict. Server Actions untuk mutasi; multi-step (penjualan/pembelian) pakai RPC/transaction agar atomik (BR-12).
- Format uang: `Intl.NumberFormat('id-ID', {style:'currency', currency:'IDR', maximumFractionDigits:0})`.
- Tanggal: date-fns + locale id.
- UI: Tailwind + shadcn/ui, tema clean & elegan, sidebar collapsible, responsive mobile-first, dark mode opsional.
- PDF: @react-pdf/renderer via route handler.
- PWA: next-pwa / serwist, manifest + ikon + installable; cache halaman baca.
- Grafik: recharts.
- Kunci enkripsi credentials: env `CREDENTIALS_SECRET_KEY`, dekripsi hanya lewat route handler server (tidak pernah di client).

---

## 7. PEMBAGIAN PHASE & CHECKPOINT SYSTEM

> **Cara pakai:** kerjakan satu phase per sesi. Setiap selesai sub-langkah, catat kodenya
> (misal `CP-3.2`). Di sesi berikutnya, berikan dokumen ini + kalimat:
> *"Lanjutkan dari CP-3.2. Kondisi terakhir: [ceritakan singkat / tempel error jika ada]."*

| Phase | Isi | Checkpoint |
|---|---|---|
| **0. Setup** | Buat proyek Next.js, install deps, setup Supabase (proyek, SQL section 5, buat user admin), env, koneksi, deploy pertama ke Vercel | CP-0.1 proyek jalan lokal · CP-0.2 SQL sukses · CP-0.3 env terhubung · CP-0.4 deploy Vercel |
| **1. Fondasi** | Login page, middleware proteksi, layout sidebar + navigasi, halaman Settings (kategori & label CRUD) | CP-1.1 login · CP-1.2 layout · CP-1.3 kategori/label |
| **2. Master Data** | Wallets (CRUD + saldo view + transfer), Clients, Distributors, Products/Stok (+ movements + penyesuaian) | CP-2.1 wallet · CP-2.2 client · CP-2.3 distributor · CP-2.4 produk |
| **3. Transaksi** | Pembelian (multi-item + efek stok + wallet), Penjualan (multi-item + validasi stok + auto asset + cash/piutang), Pengeluaran operasional & pribadi | CP-3.1 pembelian · CP-3.2 penjualan · CP-3.3 pengeluaran |
| **4. Invoice Bulanan** | Generate invoice dari penjualan piutang, status flow, tandai lunas → wallet, PDF export | CP-4.1 generate · CP-4.2 lunas · CP-4.3 PDF |
| **5. Asset & Garansi** | Halaman asset client, status garansi realtime, input manual, log perbaikan | CP-5.1 list+status · CP-5.2 log perbaikan |
| **6. Credentials & CCTV** | Network credentials + CCTV, enkripsi password, show/hide/copy, log perbaikan | CP-6.1 network · CP-6.2 cctv |
| **7. RAB** | CRUD proyek, tabel dinamis budget & expense, laba otomatis, PDF | CP-7.1 form · CP-7.2 laba · CP-7.3 PDF |
| **8. Dashboard & Laporan** | Semua kartu & grafik dashboard, halaman laporan keuangan lengkap | CP-8.1 dashboard · CP-8.2 laporan |
| **9. Client 360 & PWA** | Halaman Client 360 lengkap, PWA (manifest, installable, offline read), polish UI, testing akhir | CP-9.1 client360 · CP-9.2 PWA · CP-9.3 final |

---

## 8. TEMPLATE PROMPT PER SESI (copy-paste ke AI)

```
Kamu adalah senior full-stack developer. Baca dan patuhi MASTER PROMPT terlampir
(PBMS-IT, Next.js + Supabase + Vercel).

Status: saya sudah menyelesaikan sampai [CP-X.X].
Kondisi terakhir: [ceritakan singkat, tempel error/kode jika ada].

Tugas sekarang: kerjakan [Phase X / CP-X.X berikutnya] sesuai spesifikasi di
section 3 (fitur), section 4 (business rules), section 5 (database), dan
section 6 (struktur & konvensi).

Aturan:
1. Berikan kode LENGKAP siap copy-paste (bukan potongan), sebutkan path file.
2. Ikuti struktur folder section 6 dan business rules section 4 tanpa terkecuali.
3. Jelaskan langkah setup/pengujian singkat setelah kode.
4. Di akhir jawaban, tulis checkpoint yang tercapai dan checkpoint berikutnya.
5. Jangan kerjakan phase lain sebelum diminta.
```

---

## 9. ROADMAP MASA DEPAN (di luar scope awal, dicatat agar arsitektur siap)
- HPP/COGS per penjualan (laba kotor per barang), reminder WhatsApp garansi/invoice,
  lampiran foto (Supabase Storage), backup/export Excel, multi-user teknisi, notifikasi push PWA.
