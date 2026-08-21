-- ============================================================
-- 2026-08-21 — DUA BRAND penjualan/invoice: ATHAYA COMPUTER & CETAK IDE.
--
-- Konteks: usaha berkembang → dipisah dua brand. "Athaya Computer" (komputer/
-- printer/servis) dan "Cetak Ide" (ATK/percetakan/desain). Client YANG SAMA
-- bisa punya DUA invoice bulanan terpisah pada bulan yang sama (satu per brand).
--
-- PRINSIP: brand murni dimensi LABEL + PENGELOMPOKAN + TAMPILAN. Semua alur
-- uang (wallet, HPP, PPh 23, piutang, stok) TIDAK berubah — brand tidak pernah
-- masuk hitungan keuangan. Karena entitas sama (rekening bank & pajak sama),
-- laporan keuangan tetap utuh.
--
-- Keputusan user:
--   - Athaya = tetap seri nomor "INV/YYYY/MM/NNN" (invoice lama tak diusik).
--   - Cetak Ide = seri baru "CTK/YYYY/MM/NNN".
--   - Brand ditandai PER-NOTA (dipilih saat input penjualan).
--   - Pengelompokan invoice bulanan Cetak Ide identik Athaya, disegmen brand.
--   - Maintenance (servis komputer) selalu brand 'athaya'.
--
-- Additive & mundur-kompatibel: kolom brand default 'athaya' → semua data lama
-- otomatis jadi Athaya. Fungsi yang tambah argumen memakai DEFAULT 'athaya' agar
-- pemanggilan lama (mis. create_quick_deal → create_sale) tetap jalan.
-- ============================================================

-- ---------- (0) Kolom brand ----------
alter table public.monthly_invoices
  add column if not exists brand text not null default 'athaya';
alter table public.monthly_invoices
  drop constraint if exists monthly_invoices_brand_check;
alter table public.monthly_invoices
  add constraint monthly_invoices_brand_check check (brand in ('athaya','cetak_ide'));

alter table public.sales
  add column if not exists brand text not null default 'athaya';
alter table public.sales
  drop constraint if exists sales_brand_check;
alter table public.sales
  add constraint sales_brand_check check (brand in ('athaya','cetak_ide'));

comment on column public.monthly_invoices.brand is
  'Brand penerbit invoice: athaya (INV/...) atau cetak_ide (CTK/...). Hanya label & pengelompokan; tak memengaruhi keuangan.';
comment on column public.sales.brand is
  'Brand penjualan: athaya / cetak_ide. Untuk invoice bulanan, sama dengan brand invoice-nya.';

-- ---------- (1) Helper: nomor invoice berikutnya per (periode, brand) ----------
-- Prefix INV untuk athaya, CTK untuk cetak_ide. Nomor = MAX + 1 lalu naik sampai
-- benar-benar bebas (hindari kembar setelah ada invoice terhapus; dijaga index
-- unik invoice_no). Dua brand tak pernah bentrok karena prefix berbeda.
create or replace function public.next_invoice_no(p_period date, p_brand text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_start date := date_trunc('month', p_period)::date;
  v_prefix text := case when p_brand = 'cetak_ide' then 'CTK' else 'INV' end;
  v_seq int;
  v_no text;
begin
  select coalesce(max(nullif(regexp_replace(invoice_no, '^.*/', ''), '')::int), 0) + 1
    into v_seq
  from monthly_invoices
  where user_id = v_uid
    and date_trunc('month', period_month) = v_start
    and invoice_no ~ ('^' || v_prefix || '/\d{4}/\d{2}/\d+$');

  loop
    v_no := v_prefix || '/' || to_char(v_start, 'YYYY/MM') || '/' || lpad(v_seq::text, 3, '0');
    exit when not exists (
      select 1 from monthly_invoices where user_id = v_uid and invoice_no = v_no
    );
    v_seq := v_seq + 1;
  end loop;

  return v_no;
end $$;

-- ---------- (2) find_or_create_invoice: + brand (DROP+CREATE, tambah argumen) ----------
-- Cabang "cari invoice cocok & belum lunas" kini WAJIB brand sama → penjualan
-- Cetak Ide tak nyasar ke invoice Athaya dan sebaliknya.
drop function if exists public.find_or_create_invoice(uuid, date, date);
create function public.find_or_create_invoice(
  p_client_id uuid, p_period_month date, p_due_date date, p_brand text default 'athaya'
)
returns uuid
language plpgsql
security definer
as $function$
declare
  v_uid uuid := auth.uid();
  v_start date := date_trunc('month', p_period_month)::date;
  v_brand text := case when p_brand = 'cetak_ide' then 'cetak_ide' else 'athaya' end;
  v_invoice_id uuid;
begin
  -- cari invoice cocok (client+periode+jatuh tempo+BRAND) & belum lunas
  select id into v_invoice_id
  from monthly_invoices
  where user_id = v_uid
    and client_id = p_client_id
    and brand = v_brand
    and date_trunc('month', period_month) = v_start
    and coalesce(due_date, date '9999-12-31') = coalesce(p_due_date, date '9999-12-31')
    and status <> 'paid'
  limit 1;

  if v_invoice_id is not null then
    return v_invoice_id;
  end if;

  insert into monthly_invoices(user_id, client_id, invoice_no, period_month, status, total, due_date, brand)
  values (v_uid, p_client_id, next_invoice_no(v_start, v_brand), v_start, 'draft', 0, p_due_date, v_brand)
  returning id into v_invoice_id;

  return v_invoice_id;
end $function$;

-- ---------- (3) create_sale: + brand (DROP+CREATE, argumen p_brand di AKHIR) ----------
-- Pemanggil lama (create_quick_deal, 8 argumen) tetap jalan → default 'athaya'.
drop function if exists public.create_sale(uuid, uuid, date, public.payment_method, text, jsonb, date, date);
create function public.create_sale(
  p_client_id uuid, p_wallet_id uuid, p_sale_date date,
  p_payment_method public.payment_method, p_notes text, p_items jsonb,
  p_period_month date default null::date, p_due_date date default null::date,
  p_brand text default 'athaya'
) returns uuid
    language plpgsql security definer
    as $$
declare
  v_uid uuid := auth.uid();
  v_sale_id uuid;
  v_total numeric(15,2) := 0;
  v_item jsonb;
  v_stock int;
  v_pname text;
  v_sale_item_id uuid;
  v_wmonths int;
  v_cost numeric(15,2);
  v_invoice_id uuid := null;
  v_is_service boolean;
  v_product_id uuid;
  v_sname text;
  v_track_asset boolean;
  v_brand text := case when p_brand = 'cetak_ide' then 'cetak_ide' else 'athaya' end;
begin
  if p_payment_method in ('cash','transfer') and p_wallet_id is null then
    raise exception 'Penjualan tunai/transfer wajib memilih wallet';
  end if;
  if p_payment_method = 'monthly_invoice' and p_period_month is null then
    raise exception 'Penjualan invoice wajib memilih periode';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'Minimal 1 barang harus diisi';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    if coalesce((v_item->>'is_service')::boolean, false) then
      v_total := v_total + (v_item->>'qty')::int * (v_item->>'price')::numeric;
      continue;
    end if;
    select current_stock, name into v_stock, v_pname
      from v_product_stock where id=(v_item->>'product_id')::uuid;
    if v_stock is null then raise exception 'Barang tidak ditemukan'; end if;
    if (v_item->>'qty')::int > v_stock then
      raise exception 'Stok "%" tidak cukup (tersedia %, diminta %)',
        v_pname, v_stock, (v_item->>'qty')::int;
    end if;
    v_total := v_total + (v_item->>'qty')::int * (v_item->>'price')::numeric;
  end loop;

  -- hanya invoice bulanan yang membuat/menyatu ke invoice (disegmen per BRAND)
  if p_payment_method = 'monthly_invoice' then
    v_invoice_id := find_or_create_invoice(p_client_id, p_period_month, p_due_date, v_brand);
  end if;

  insert into sales(
    user_id, client_id, wallet_id, sale_date, payment_method, total, notes,
    monthly_invoice_id, due_date, paid_date, paid_wallet_id, brand)
  values (
    v_uid, p_client_id,
    case when p_payment_method in ('cash','transfer') then p_wallet_id else null end,
    p_sale_date, p_payment_method, v_total, nullif(p_notes,''),
    v_invoice_id,
    case when p_payment_method = 'terhutang' then p_due_date else null end,
    case when p_payment_method in ('cash','transfer') then p_sale_date else null end,
    case when p_payment_method in ('cash','transfer') then p_wallet_id else null end,
    v_brand)
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_is_service := coalesce((v_item->>'is_service')::boolean, false);

    if v_is_service then
      v_sname := trim(v_item->>'name');
      if v_sname is null or v_sname = '' then
        raise exception 'Nama jasa tidak boleh kosong';
      end if;
      v_product_id := find_or_create_service_product('Jasa');

      insert into sale_items(user_id, sale_id, product_id, qty, price, cost_price,
                             warranty_months, serial_number, item_name)
      values (v_uid, v_sale_id, v_product_id,
              (v_item->>'qty')::int, (v_item->>'price')::numeric, 0,
              0, null, v_sname);
      continue;
    end if;

    v_wmonths := coalesce((v_item->>'warranty_months')::int, 12);

    select name, coalesce(last_purchase_price, 0), track_as_asset
      into v_pname, v_cost, v_track_asset
      from products where id=(v_item->>'product_id')::uuid;

    insert into sale_items(user_id, sale_id, product_id, qty, price, cost_price,
                           warranty_months, serial_number, item_name)
    values (v_uid, v_sale_id, (v_item->>'product_id')::uuid,
            (v_item->>'qty')::int, (v_item->>'price')::numeric, v_cost,
            v_wmonths, nullif(v_item->>'serial_number',''), null)
    returning id into v_sale_item_id;

    insert into stock_movements(user_id, product_id, type, qty, ref_type, ref_id, note)
    values (v_uid, (v_item->>'product_id')::uuid, 'sale_out',
            -1 * (v_item->>'qty')::int, 'sale', v_sale_id, 'Penjualan barang');

    if coalesce(v_track_asset, true) then
      insert into client_assets(user_id, client_id, sale_item_id, product_name, serial_number, purchase_date, warranty_end, notes)
      values (v_uid, p_client_id, v_sale_item_id, v_pname,
              nullif(v_item->>'serial_number',''), p_sale_date,
              (p_sale_date + (v_wmonths || ' months')::interval)::date, null);
    end if;
  end loop;

  if p_payment_method in ('cash','transfer') then
    insert into wallet_transactions(user_id, wallet_id, type, amount, tx_date, ref_type, ref_id, description)
    values (v_uid, p_wallet_id, 'income', v_total, p_sale_date, 'sale', v_sale_id,
            case when p_payment_method='transfer' then 'Penjualan transfer' else 'Penjualan tunai' end);
  elsif p_payment_method = 'monthly_invoice' then
    update monthly_invoices set total = total + v_total
      where id = v_invoice_id and user_id = v_uid;
  end if;

  return v_sale_id;
end $$;

-- ---------- (4) issue_maintenance_charges: maintenance selalu 'athaya' ----------
-- (tanda tangan sama → CREATE OR REPLACE). Draft yang boleh digabungi dibatasi
-- brand='athaya' agar tagihan servis tak nyasar ke invoice Cetak Ide.
create or replace function public.issue_maintenance_charges(p_period date, p_charges jsonb)
  returns integer
  language plpgsql
  security definer
  as $$
declare
  v_uid uuid := auth.uid();
  v_row jsonb;
  v_contract_id uuid;
  v_amount numeric(15,2);
  v_client uuid;
  v_name text;
  v_due_day int;
  v_active boolean;
  v_period date := date_trunc('month', p_period)::date;
  v_sale_date date;
  v_product uuid;
  v_sale_id uuid;
  v_invoice uuid;
  v_due date;
  v_next date;
  v_lastday date;
  v_count int := 0;
begin
  if jsonb_array_length(p_charges) = 0 then
    raise exception 'Tidak ada kontrak yang dipilih';
  end if;

  v_sale_date := (v_period + interval '1 month - 1 day')::date;

  for v_row in select * from jsonb_array_elements(p_charges) loop
    v_contract_id := (v_row->>'contract_id')::uuid;
    v_amount := coalesce((v_row->>'amount')::numeric, 0);

    if v_amount <= 0 then
      raise exception 'Nominal tagihan harus lebih dari 0';
    end if;

    select client_id, service_name, due_day, is_active
      into v_client, v_name, v_due_day, v_active
      from maintenance_contracts
      where id = v_contract_id and user_id = v_uid;

    if v_client is null then
      raise exception 'Kontrak tidak ditemukan';
    end if;
    if not v_active then
      raise exception 'Kontrak "%" sudah dihentikan', v_name;
    end if;

    if exists (
      select 1 from sales
      where user_id = v_uid
        and maintenance_contract_id = v_contract_id
        and maintenance_period = v_period
    ) then
      raise exception 'Kontrak "%" sudah ditagih untuk periode ini', v_name;
    end if;

    v_product := find_or_create_service_product(v_name);

    insert into sales(user_id, client_id, wallet_id, sale_date, payment_method,
                      total, notes, maintenance_contract_id, maintenance_period, brand)
    values (v_uid, v_client, null, v_sale_date, 'monthly_invoice',
            v_amount, null, v_contract_id, v_period, 'athaya')
    returning id into v_sale_id;

    insert into sale_items(user_id, sale_id, product_id, qty, price,
                           warranty_months, serial_number)
    values (v_uid, v_sale_id, v_product, 1, v_amount, 0, null);

    -- HANYA invoice DRAFT brand ATHAYA yang boleh digabungi
    select id into v_invoice from monthly_invoices
      where user_id = v_uid
        and client_id = v_client
        and brand = 'athaya'
        and period_month = v_period
        and status = 'draft'
      order by created_at
      limit 1;

    if v_invoice is null then
      v_next := (v_period + interval '1 month')::date;
      v_lastday := (v_next + interval '1 month - 1 day')::date;
      if v_due_day = 0 then
        v_due := v_lastday;
      else
        v_due := least((v_next + (v_due_day - 1))::date, v_lastday);
      end if;

      insert into monthly_invoices(user_id, client_id, invoice_no, period_month,
                                   status, total, due_date, brand)
      values (v_uid, v_client, next_invoice_no(v_period, 'athaya'), v_period, 'draft', 0, v_due, 'athaya')
      returning id into v_invoice;
    end if;

    update sales set monthly_invoice_id = v_invoice
      where id = v_sale_id and user_id = v_uid;

    update monthly_invoices set total = coalesce((
      select sum(total) from sales where monthly_invoice_id = v_invoice and user_id = v_uid
    ), 0)
    where id = v_invoice and user_id = v_uid;

    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;

-- ---------- (5) generate_monthly_invoice: + brand (DROP+CREATE) ----------
-- Dipakai menu "buat invoice manual" (saat ini tak terpasang di UI, tetap dijaga
-- konsisten). Mengelompokkan HANYA penjualan brand yang diminta.
drop function if exists public.generate_monthly_invoice(uuid, date, date);
create function public.generate_monthly_invoice(
  p_client_id uuid, p_period_month date, p_due_date date, p_brand text default 'athaya'
)
  returns uuid
  language plpgsql
  security definer
  as $_$
declare
  v_uid uuid := auth.uid();
  v_start date := date_trunc('month', p_period_month)::date;
  v_end date := (date_trunc('month', p_period_month) + interval '1 month - 1 day')::date;
  v_brand text := case when p_brand = 'cetak_ide' then 'cetak_ide' else 'athaya' end;
  v_total numeric(15,2) := 0;
  v_count int;
  v_invoice_id uuid;
begin
  select coalesce(sum(total),0), count(*) into v_total, v_count
  from sales
  where user_id = v_uid
    and client_id = p_client_id
    and brand = v_brand
    and payment_method = 'monthly_invoice'
    and monthly_invoice_id is null
    and sale_date between v_start and v_end;

  if v_count = 0 then
    raise exception 'Tidak ada penjualan piutang untuk client ini pada periode tersebut';
  end if;

  select id into v_invoice_id
  from monthly_invoices
  where user_id = v_uid
    and client_id = p_client_id
    and brand = v_brand
    and period_month = v_start
    and status = 'draft'
  order by created_at
  limit 1;

  if v_invoice_id is null then
    insert into monthly_invoices(user_id, client_id, invoice_no, period_month, status, total, due_date, brand)
    values (v_uid, p_client_id, next_invoice_no(v_start, v_brand), v_start, 'draft', 0, p_due_date, v_brand)
    returning id into v_invoice_id;
  end if;

  update sales set monthly_invoice_id = v_invoice_id
  where user_id = v_uid
    and client_id = p_client_id
    and brand = v_brand
    and payment_method = 'monthly_invoice'
    and monthly_invoice_id is null
    and sale_date between v_start and v_end;

  update monthly_invoices set total = coalesce((
    select sum(total) from sales where monthly_invoice_id = v_invoice_id and user_id = v_uid
  ), 0)
  where id = v_invoice_id and user_id = v_uid;

  return v_invoice_id;
end $_$;

-- ---------- (6) add_invoice_item: warisi brand dari invoice-nya ----------
-- (tanda tangan sama → CREATE OR REPLACE). Penjualan baru yang ditautkan langsung
-- ke invoice harus ber-brand SAMA dengan invoice tersebut.
create or replace function public.add_invoice_item(
  p_invoice_id uuid,
  p_is_service boolean,
  p_product_id uuid,
  p_item_name text,
  p_qty int,
  p_price numeric,
  p_warranty_months int default 12,
  p_serial text default null
)
returns void
language plpgsql
security definer
as $function$
declare
  v_uid uuid := auth.uid();
  v_client uuid;
  v_period date;
  v_status invoice_status;
  v_brand text;
  v_sale_date date;
  v_sale_id uuid;
  v_stock int;
  v_pname text;
  v_cost numeric(15,2);
  v_track boolean;
  v_service_pid uuid;
  v_sname text;
  v_sale_item_id uuid;
  v_warr int;
begin
  select client_id, period_month, status, brand
    into v_client, v_period, v_status, v_brand
    from monthly_invoices where id = p_invoice_id and user_id = v_uid;

  if v_client is null then
    raise exception 'Invoice tidak ditemukan';
  end if;
  if v_status = 'paid' then
    raise exception 'Invoice sudah lunas. Batalkan lunas dulu sebelum menambah baris.';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'Qty harus lebih dari 0';
  end if;
  if p_price is null or p_price < 0 then
    raise exception 'Harga tidak valid';
  end if;

  v_sale_date := (date_trunc('month', v_period) + interval '1 month - 1 day')::date;

  insert into sales(user_id, client_id, wallet_id, sale_date, payment_method,
                    total, notes, monthly_invoice_id, brand)
  values (v_uid, v_client, null, v_sale_date, 'monthly_invoice',
          p_qty * p_price, null, p_invoice_id, coalesce(v_brand, 'athaya'))
  returning id into v_sale_id;

  if coalesce(p_is_service, false) then
    v_sname := trim(p_item_name);
    if v_sname is null or v_sname = '' then
      raise exception 'Nama jasa tidak boleh kosong';
    end if;
    v_service_pid := find_or_create_service_product('Jasa');
    insert into sale_items(user_id, sale_id, product_id, qty, price, cost_price,
                           warranty_months, serial_number, item_name)
    values (v_uid, v_sale_id, v_service_pid, p_qty, p_price, 0, 0, null, v_sname);
  else
    if p_product_id is null then
      raise exception 'Barang wajib dipilih';
    end if;
    select current_stock, name into v_stock, v_pname
      from v_product_stock where id = p_product_id;
    if v_stock is null then
      raise exception 'Barang tidak ditemukan';
    end if;
    if p_qty > v_stock then
      raise exception 'Stok "%" tidak cukup (tersedia %, diminta %)',
        v_pname, v_stock, p_qty;
    end if;

    v_warr := coalesce(p_warranty_months, 12);
    select coalesce(last_purchase_price, 0), track_as_asset
      into v_cost, v_track
      from products where id = p_product_id;

    insert into sale_items(user_id, sale_id, product_id, qty, price, cost_price,
                           warranty_months, serial_number, item_name)
    values (v_uid, v_sale_id, p_product_id, p_qty, p_price, v_cost,
            v_warr, nullif(p_serial, ''), null)
    returning id into v_sale_item_id;

    insert into stock_movements(user_id, product_id, type, qty, ref_type, ref_id, note)
    values (v_uid, p_product_id, 'sale_out', -1 * p_qty, 'sale', v_sale_id,
            'Penjualan barang');

    if coalesce(v_track, true) then
      insert into client_assets(user_id, client_id, sale_item_id, product_name,
                                serial_number, purchase_date, warranty_end, notes)
      values (v_uid, v_client, v_sale_item_id, v_pname, nullif(p_serial, ''),
              v_sale_date,
              (v_sale_date + (v_warr || ' months')::interval)::date, null);
    end if;
  end if;

  update monthly_invoices set total = coalesce((
    select sum(total) from sales where monthly_invoice_id = p_invoice_id and user_id = v_uid
  ), 0)
  where id = p_invoice_id and user_id = v_uid;
end $function$;

-- ---------- (7) v_monthly_invoices: expose brand (kolom baru di AKHIR SELECT) ----------
create or replace view public.v_monthly_invoices as
 SELECT mi.id,
    mi.user_id,
    mi.client_id,
    mi.invoice_no,
    mi.period_month,
    mi.status,
    mi.total,
    mi.due_date,
    mi.paid_date,
    mi.paid_wallet_id,
    mi.notes,
    mi.created_at,
    c.company_name,
    c.contact_name,
    c.address AS client_address,
    c.phone AS client_phone,
    c.email AS client_email,
        CASE
            WHEN mi.status = 'paid'::invoice_status THEN 'paid'::text
            WHEN mi.due_date IS NOT NULL AND mi.due_date < CURRENT_DATE THEN 'overdue'::text
            ELSE mi.status::text
        END AS effective_status,
    mi.email_sent_at,
    mi.email_sent_to,
    mi.pph_base,
    mi.pph_rate,
    mi.pph_amount,
    mi.brand
   FROM monthly_invoices mi
     JOIN clients c ON c.id = mi.client_id;

-- view menghormati RLS penanya (dipertahankan dari hardening 2.1)
alter view public.v_monthly_invoices set (security_invoker = on);
