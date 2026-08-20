-- ============================================================
-- Pemeriksaan Data — tambah grup E "Konsistensi Keuangan" (hasil Audit Tahap 5).
-- 16 cek lama (A–D, integritas) DIPERTAHANKAN; ditambah E1–E5 (rekonsiliasi
-- wallet & modal). Read-only, scoped auth.uid(), tak mengubah data.
-- ============================================================

create or replace function public.data_integrity_report()
returns jsonb
language plpgsql
security definer
as $function$
declare
  u uuid := auth.uid();
  a1 int; a2 int; a3 int; a4 int; a5 int; a6 int; a7 int;
  b1 int; b2 int;
  c1 int; c2 int; c3 int; c4 int; c5 int;
  d1 int; d2 int;
  e1 int; e2 int; e3 int; e4 int; e5 int;
begin
  select count(*) into a1 from sales
    where user_id=u and payment_method='monthly_invoice' and monthly_invoice_id is null;
  select count(*) into a2 from sales s
    where s.user_id=u and s.monthly_invoice_id is not null
      and not exists (select 1 from monthly_invoices mi where mi.id=s.monthly_invoice_id);
  select count(*) into a3 from sale_items si
    where si.user_id=u and not exists (select 1 from sales s where s.id=si.sale_id);
  select count(*) into a4 from client_assets ca
    where ca.user_id=u and ca.sale_item_id is not null
      and not exists (select 1 from sale_items si where si.id=ca.sale_item_id);
  select count(*) into a5 from stock_movements m
    where m.user_id=u and m.ref_type='sale'
      and not exists (select 1 from sales s where s.id=m.ref_id);
  select count(*) into a6 from monthly_invoices mi
    where mi.user_id=u and not exists (select 1 from sales s where s.monthly_invoice_id=mi.id);
  select count(*) into a7 from wallet_transactions w
    where w.user_id=u and w.ref_type='sale'
      and not exists (select 1 from sales s where s.id=w.ref_id);
  select count(*) into b1 from (
    select invoice_no from monthly_invoices where user_id=u
    group by invoice_no having count(*)>1) x;
  select count(*) into b2 from monthly_invoices
    where user_id=u and invoice_no !~ '^INV/\d{4}/\d{2}/\d+$';
  select count(*) into c1 from monthly_invoices mi
    where mi.user_id=u
      and mi.total <> coalesce((select sum(s.total) from sales s where s.monthly_invoice_id=mi.id),0);
  select count(*) into c2 from monthly_invoices
    where user_id=u and status='paid' and (paid_date is null or paid_wallet_id is null);
  select count(*) into c3 from sales
    where user_id=u and payment_method in ('cash','transfer') and wallet_id is null;
  select count(*) into c4 from v_wallet_balances b
    join wallets w on w.id=b.id where w.user_id=u and b.balance < 0;
  select count(*) into c5 from sales
    where user_id=u and payment_method='terhutang' and paid_date is not null and paid_wallet_id is null;
  select count(*) into d1 from v_product_stock where user_id=u and current_stock < 0;
  select count(*) into d2 from products p
    where p.user_id=u and p.is_service=true
      and exists (select 1 from stock_movements m where m.product_id=p.id);

  -- ===== Grup E — Konsistensi Keuangan (Audit Tahap 5) =====
  -- E1: barang (bukan jasa) terjual tapi modal tercatat 0 → HPP hilang, laba dibesar-besarkan.
  select count(*) into e1 from sale_items si
    join products p on p.id=si.product_id
    where si.user_id=u and coalesce(p.is_service,false)=false
      and coalesce(si.cost_price,0)=0 and si.qty>0;
  -- E2: invoice lunas tapi pemasukan wallet (netto) ≠ total − PPh.
  select count(*) into e2 from monthly_invoices mi
    where mi.user_id=u and mi.status='paid'
      and coalesce((select sum(w.amount) from wallet_transactions w
          where w.ref_type='invoice' and w.ref_id=mi.id and w.type='income'),0)
          <> (mi.total - coalesce(mi.pph_amount,0));
  -- E3: penjualan terhutang sudah lunas tapi pemasukan wallet ≠ total.
  select count(*) into e3 from sales s
    where s.user_id=u and s.payment_method='terhutang' and s.paid_date is not null
      and coalesce((select sum(w.amount) from wallet_transactions w
          where w.ref_type='sale' and w.ref_id=s.id and w.type='income'),0) <> s.total;
  -- E4: penjualan tunai/transfer tapi pemasukan wallet ≠ total.
  select count(*) into e4 from sales s
    where s.user_id=u and s.payment_method in ('cash','transfer')
      and coalesce((select sum(w.amount) from wallet_transactions w
          where w.ref_type='sale' and w.ref_id=s.id and w.type='income'),0) <> s.total;
  -- E5: pembelian tapi pengeluaran wallet ≠ total.
  select count(*) into e5 from purchases pu
    where pu.user_id=u
      and coalesce((select sum(w.amount) from wallet_transactions w
          where w.ref_type='purchase' and w.ref_id=pu.id and w.type='expense'),0) <> pu.total;

  return jsonb_build_array(
    jsonb_build_object('code','A1','label','Penjualan invoice-bulanan tanpa invoice','count',a1),
    jsonb_build_object('code','A2','label','Penjualan menunjuk invoice yang tidak ada','count',a2),
    jsonb_build_object('code','A3','label','Item penjualan tanpa induk penjualan','count',a3),
    jsonb_build_object('code','A4','label','Aset client tanpa item penjualan (orphan)','count',a4),
    jsonb_build_object('code','A5','label','Pergerakan stok menunjuk penjualan yang hilang','count',a5),
    jsonb_build_object('code','A6','label','Invoice tanpa penjualan tertaut','count',a6),
    jsonb_build_object('code','A7','label','Mutasi wallet menunjuk penjualan yang hilang','count',a7),
    jsonb_build_object('code','B1','label','Nomor invoice kembar','count',b1),
    jsonb_build_object('code','B2','label','Nomor invoice format tidak standar','count',b2),
    jsonb_build_object('code','C1','label','Total invoice tidak cocok jumlah penjualan','count',c1),
    jsonb_build_object('code','C2','label','Invoice lunas tanpa tanggal/wallet bayar','count',c2),
    jsonb_build_object('code','C3','label','Penjualan tunai/transfer tanpa wallet','count',c3),
    jsonb_build_object('code','C4','label','Saldo wallet negatif','count',c4),
    jsonb_build_object('code','C5','label','Penjualan terhutang lunas tanpa wallet','count',c5),
    jsonb_build_object('code','D1','label','Produk stok negatif','count',d1),
    jsonb_build_object('code','D2','label','Produk jasa memiliki pergerakan stok','count',d2),
    jsonb_build_object('code','E1','label','Barang terjual tanpa modal (HPP 0)','count',e1),
    jsonb_build_object('code','E2','label','Invoice lunas: netto wallet tidak cocok (total − PPh)','count',e2),
    jsonb_build_object('code','E3','label','Terhutang lunas: pemasukan wallet tidak cocok total','count',e3),
    jsonb_build_object('code','E4','label','Penjualan tunai/transfer: pemasukan wallet tidak cocok total','count',e4),
    jsonb_build_object('code','E5','label','Pembelian: pengeluaran wallet tidak cocok total','count',e5)
  );
end $function$;

revoke execute on function public.data_integrity_report() from anon;
grant  execute on function public.data_integrity_report() to authenticated;
