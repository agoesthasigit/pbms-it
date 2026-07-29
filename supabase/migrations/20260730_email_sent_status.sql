-- ============================================================
--  Fitur "Kirim via Gmail" — jejak status pengiriman email.
--
--  Menambah kolom pencatatan kapan & ke email mana sebuah invoice
--  bulanan / nota penjualan terakhir dikirim lewat aplikasi.
--  Kolom bersifat additive (nullable) → aman untuk data lama.
--
--  View v_monthly_invoices dibuat ulang agar mengekspos kolom baru
--  (dipakai halaman Invoice untuk menandai "sudah dikirim").
-- ============================================================

-- 1) Kolom jejak kirim di kedua tabel
ALTER TABLE public.monthly_invoices
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_sent_to text;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_sent_to text;

-- 2) Perbarui view invoice agar ikut membawa kolom baru.
--    (definisi lama + tambahan email_sent_at / email_sent_to)
CREATE OR REPLACE VIEW public.v_monthly_invoices AS
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
            WHEN (mi.status = 'paid'::public.invoice_status) THEN 'paid'::text
            WHEN ((mi.due_date IS NOT NULL) AND (mi.due_date < CURRENT_DATE)) THEN 'overdue'::text
            ELSE (mi.status)::text
        END AS effective_status,
    -- kolom baru WAJIB di akhir agar CREATE OR REPLACE VIEW diterima Postgres
    mi.email_sent_at,
    mi.email_sent_to
   FROM (public.monthly_invoices mi
     JOIN public.clients c ON ((c.id = mi.client_id)));
