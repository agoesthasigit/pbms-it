import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { buildTransactionRows } from "@/lib/reports/transactions";
import { TransactionList } from "./transaction-list";

export const metadata = { title: "Riwayat Transaksi" };

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function TransactionsPage() {
  const supabase = await createClient();

  const [rows, { data: wallets }, { data: categories }, { data: labels }] =
    await Promise.all([
      buildTransactionRows(supabase),
      supabase.from("wallets").select("id, name").order("created_at"),
      supabase.from("categories").select("id, name, type")
        .in("type", ["operational_expense", "personal_expense"])
        .eq("is_active", true).order("name"),
      supabase.from("labels").select("id, name").order("name"),
    ]);

  const walletOpts = ((wallets ?? []) as any[]).map((w) => ({ value: w.id, label: w.name }));
  const categoryOpts = ((categories ?? []) as any[]).map((c) => ({ value: c.id, label: c.name }));
  const labelOpts = ((labels ?? []) as any[]).map((l) => ({ value: l.id, label: l.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Riwayat Transaksi"
        description="Semua transaksi uang (penjualan, pembelian, pengeluaran operasional & pribadi, pelunasan invoice, termin & biaya proyek selesai) dalam satu halaman. Baris merah = piutang yang belum diterima."
      />
      <TransactionList
        rows={rows}
        wallets={walletOpts}
        categories={categoryOpts}
        labels={labelOpts}
      />
    </div>
  );
}
