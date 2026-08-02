-- ============================================================
-- PPh 23 (2,5%) atas JASA pada pelunasan invoice bulanan.
--
-- Konsep (Opsi B — dipilih user 2026-08-02):
--   Invoice TETAP ditagihkan penuh (bruto) — PDF invoice tidak berubah
--   sama sekali. Client memotong PPh 23 sebesar 2,5% dari nilai JASA
--   saja (barang TIDAK kena), lalu membayar netto.
--   Yang masuk wallet = NETTO → saldo wallet tetap sama persis dengan
--   mutasi bank. PPh dicatat sebagai BIAYA bertanda "Pajak PPh 23"
--   di laporan laba rugi.
-- ============================================================

alter table monthly_invoices
  add column if not exists pph_base   numeric(15,2) not null default 0,
  add column if not exists pph_rate   numeric(5,2)  not null default 2.5,
  add column if not exists pph_amount numeric(15,2) not null default 0;

comment on column monthly_invoices.pph_base is
  'Dasar kena pajak = nilai JASA saja (penjualan barang tidak kena PPh 23)';
comment on column monthly_invoices.pph_rate is
  'Tarif PPh 23 dalam persen (default 2,5)';
comment on column monthly_invoices.pph_amount is
  'PPh yang dipotong client = pph_base * pph_rate / 100';

-- ------------------------------------------------------------
-- Dasar kena pajak OTOMATIS: jumlah baris JASA pada semua penjualan
-- yang tergabung di invoice ini. Baris kontrak maintenance memakai
-- produk is_service, jadi otomatis ikut terhitung; baris barang tidak.
-- ------------------------------------------------------------
create or replace function public.invoice_service_base(p_invoice_id uuid)
returns numeric
language sql
security definer
set search_path = public
as $$
  select coalesce(sum(si.subtotal), 0)
  from sales s
  join sale_items si on si.sale_id = s.id
  join products p    on p.id = si.product_id
  where s.monthly_invoice_id = p_invoice_id
    and s.user_id = auth.uid()
    and p.is_service;
$$;

-- ------------------------------------------------------------
-- mark_invoice_paid: parameter PPh ditambahkan DI AKHIR dengan
-- default, jadi pemanggilan lama (3 argumen) tetap jalan.
-- ------------------------------------------------------------
create or replace function public.mark_invoice_paid(
  p_invoice_id uuid,
  p_wallet_id  uuid,
  p_paid_date  date,
  p_pph_base   numeric default 0,
  p_pph_rate   numeric default 2.5
)
returns void
language plpgsql
security definer
as $function$
declare
  v_uid    uuid := auth.uid();
  v_total  numeric(15,2);
  v_no     text;
  v_status invoice_status;
  v_base   numeric(15,2);
  v_rate   numeric(5,2);
  v_pph    numeric(15,2);
  v_netto  numeric(15,2);
begin
  select total, invoice_no, status into v_total, v_no, v_status
  from monthly_invoices where id = p_invoice_id and user_id = v_uid;

  if v_total is null then raise exception 'Invoice tidak ditemukan'; end if;
  if v_status = 'paid' then raise exception 'Invoice sudah lunas'; end if;
  if p_wallet_id is null then raise exception 'Pilih wallet penerima'; end if;

  v_base := greatest(coalesce(p_pph_base, 0), 0);
  v_rate := coalesce(p_pph_rate, 2.5);

  if v_base > v_total then
    raise exception 'Dasar kena pajak tidak boleh melebihi total invoice';
  end if;

  v_pph   := round(v_base * v_rate / 100, 2);
  v_netto := v_total - v_pph;

  update monthly_invoices
    set status = 'paid', paid_date = p_paid_date, paid_wallet_id = p_wallet_id,
        pph_base = v_base, pph_rate = v_rate, pph_amount = v_pph
    where id = p_invoice_id and user_id = v_uid;

  -- Wallet masuk (BR-06): pemasukan diakui saat invoice lunas.
  -- Yang masuk = NETTO agar saldo wallet sama dengan mutasi bank.
  insert into wallet_transactions(user_id, wallet_id, type, amount, tx_date,
                                  ref_type, ref_id, description)
  values (v_uid, p_wallet_id, 'income', v_netto, p_paid_date, 'invoice', p_invoice_id,
          'Pelunasan ' || v_no ||
          case when v_pph > 0 then ' (netto, PPh 23 dipotong client)' else '' end);
end $function$;

-- ------------------------------------------------------------
-- View dibuat ulang: kolom baru WAJIB di AKHIR SELECT agar
-- CREATE OR REPLACE VIEW diterima Postgres.
-- ------------------------------------------------------------
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
    mi.pph_amount
   FROM monthly_invoices mi
     JOIN clients c ON c.id = mi.client_id;
