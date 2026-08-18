-- ============================================================
-- BUG: "duplicate key value violates unique constraint
--       monthly_invoices_user_invoice_no_uniq"
--       saat menambah PENJUALAN dengan metode invoice bulanan.
--
-- Penyebab: create_sale memanggil find_or_create_invoice, dan fungsi
-- itu MASIH memakai penomoran lama `count(*) + 1`. Migrasi
-- 20260802_invoice_no_unique.sql dulu hanya memperbaiki
-- generate_monthly_invoice (dipakai dari menu Invoice), TAPI
-- find_or_create_invoice (dipakai dari menu Penjualan) terlewat.
--
-- Begitu ada satu invoice di bulan yang sama DIHAPUS, count() turun
-- sehingga nomor yang sudah pernah dipakai diberikan lagi → bentrok
-- dengan index unik.
--   Kejadian nyata (Agustus 2026): tersisa 001 & 003 (002 dihapus),
--   count(*)+1 = 3 → mencoba INV/2026/08/003 yang sudah dipakai →
--   error saat membuat penjualan invoice untuk Rob Peetoom Seminyak.
--
-- Perbaikan: samakan dengan generate_monthly_invoice —
--   nomor urut = MAX(nomor yang pernah dipakai) + 1, lalu dinaikkan
--   dalam loop sampai benar-benar belum terpakai. Nomor bekas invoice
--   yang dihapus TIDAK didaur ulang (memang seharusnya begitu).
--   Cabang "cari invoice yang cocok & belum lunas" TIDAK diubah.
-- ============================================================

create or replace function public.find_or_create_invoice(
  p_client_id uuid, p_period_month date, p_due_date date
)
returns uuid
language plpgsql
security definer
as $function$
declare
  v_uid uuid := auth.uid();
  v_start date := date_trunc('month', p_period_month)::date;
  v_invoice_id uuid;
  v_seq int;
  v_no text;
begin
  -- cari invoice yang cocok & belum lunas (tidak diubah)
  select id into v_invoice_id
  from monthly_invoices
  where user_id = v_uid
    and client_id = p_client_id
    and date_trunc('month', period_month) = v_start
    and coalesce(due_date, date '9999-12-31') = coalesce(p_due_date, date '9999-12-31')
    and status <> 'paid'
  limit 1;

  if v_invoice_id is not null then
    return v_invoice_id;
  end if;

  -- buat invoice baru. Nomor urut = MAX + 1 (BUKAN count + 1) agar tidak
  -- bentrok setelah ada invoice yang dihapus.
  select coalesce(max(nullif(regexp_replace(invoice_no, '^.*/', ''), '')::int), 0) + 1
    into v_seq
  from monthly_invoices
  where user_id = v_uid
    and date_trunc('month', period_month) = v_start
    and invoice_no ~ '^INV/\d{4}/\d{2}/\d+$';

  -- jaring pengaman: naikkan sampai nomornya benar-benar belum terpakai
  loop
    v_no := 'INV/' || to_char(v_start, 'YYYY/MM') || '/' || lpad(v_seq::text, 3, '0');
    exit when not exists (
      select 1 from monthly_invoices where user_id = v_uid and invoice_no = v_no
    );
    v_seq := v_seq + 1;
  end loop;

  insert into monthly_invoices(user_id, client_id, invoice_no, period_month, status, total, due_date)
  values (v_uid, p_client_id, v_no, v_start, 'draft', 0, p_due_date)
  returning id into v_invoice_id;

  return v_invoice_id;
end $function$;
