-- ============================================================================
-- Audit Tahap 5 — perbaikan sampingan 5.6: Dashboard undercount Piutang.
-- ============================================================================
-- `dashboard_counts.total_receivable` dulu HANYA menjumlahkan penjualan metode
-- `monthly_invoice` yang invoicenya belum lunas — penjualan `terhutang` yang belum
-- dibayar TERLEWAT → angka "Piutang" di Dashboard kurang. Kini ditambah terhutang
-- belum lunas (paid_date null) agar cocok dengan halaman /piutang.
-- Tanda tangan & kolom keluaran TIDAK berubah (aman untuk pemanggil lama).
create or replace function public.dashboard_counts()
returns table(active_clients bigint, pending_invoices bigint,
              expiring_warranty bigint, total_receivable numeric)
language sql
security definer
as $function$
  select
    (select count(*) from clients where user_id=auth.uid() and status='active'),
    (select count(*) from monthly_invoices where user_id=auth.uid() and status <> 'paid'),
    (select count(*) from v_client_assets where warranty_status='expiring'),
    -- Piutang = invoice bulanan belum lunas + penjualan terhutang belum lunas
    coalesce((select sum(total) from sales
       where user_id=auth.uid() and payment_method='monthly_invoice'
         and monthly_invoice_id in
           (select id from monthly_invoices where status <> 'paid')), 0)
    + coalesce((select sum(total) from sales
       where user_id=auth.uid() and payment_method='terhutang'
         and paid_date is null), 0)
$function$;
