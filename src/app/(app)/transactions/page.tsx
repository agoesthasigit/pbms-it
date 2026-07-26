import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { TransactionList, type TxRow } from "./transaction-list";

export const metadata = { title: "Riwayat Transaksi" };

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function TransactionsPage() {
  const supabase = await createClient();

  const [
    { data: sales }, { data: purchases }, { data: opEx }, { data: persEx },
    { data: wallets }, { data: categories }, { data: labels },
  ] = await Promise.all([
    supabase.from("sales")
      // wallet:wallets!wallet_id → tegaskan FK (sales punya 2 relasi ke wallets)
      .select("id, sale_date, total, payment_method, paid_date, wallet_id, notes, " +
        "client:clients(company_name), wallet:wallets!wallet_id(name), " +
        "invoice:monthly_invoices(status)")
      .order("sale_date", { ascending: false }),
    supabase.from("purchases")
      .select("id, purchase_date, total, wallet_id, invoice_no, notes, " +
        "distributor:distributors(name), wallet:wallets(name)")
      .order("purchase_date", { ascending: false }),
    supabase.from("operational_expenses")
      .select("id, expense_date, amount, wallet_id, category_id, label_id, description, " +
        "category:categories(name), label:labels(name,color), wallet:wallets(name)")
      .order("expense_date", { ascending: false }),
    supabase.from("personal_expenses")
      .select("id, expense_date, amount, wallet_id, category_id, label_id, description, " +
        "category:categories(name), label:labels(name,color), wallet:wallets(name)")
      .order("expense_date", { ascending: false }),
    supabase.from("wallets").select("id, name").order("created_at"),
    supabase.from("categories").select("id, name, type")
      .in("type", ["operational_expense", "personal_expense"])
      .eq("is_active", true).order("name"),
    supabase.from("labels").select("id, name").order("name"),
  ]);

  const rows: TxRow[] = [];

  for (const s of (sales ?? []) as any[]) {
    const method = s.payment_method as string;
    let piutang = false;
    if (method === "monthly_invoice") piutang = (s.invoice?.status ?? "") !== "paid";
    else if (method === "terhutang") piutang = !s.paid_date;
    rows.push({
      key: `sale-${s.id}`,
      source: "sale",
      direction: "in",
      date: s.sale_date,
      party: s.client?.company_name ?? "-",
      walletId: s.wallet_id ?? null,
      walletName: s.wallet?.name ?? (piutang ? "(belum diterima)" : "-"),
      categoryId: null,
      labelId: null,
      description: s.notes ?? "",
      amount: Number(s.total),
      isPiutang: piutang,
    });
  }

  for (const p of (purchases ?? []) as any[]) {
    rows.push({
      key: `purchase-${p.id}`,
      source: "purchase",
      direction: "out",
      date: p.purchase_date,
      party: p.distributor?.name ?? "-",
      walletId: p.wallet_id ?? null,
      walletName: p.wallet?.name ?? "-",
      categoryId: null,
      labelId: null,
      description: p.invoice_no ? `Nota ${p.invoice_no}` : (p.notes ?? ""),
      amount: Number(p.total),
      isPiutang: false,
    });
  }

  const pushExpense = (list: any[], source: "op" | "personal") => {
    for (const e of list) {
      rows.push({
        key: `${source}-${e.id}`,
        source,
        direction: "out",
        date: e.expense_date,
        party: e.category?.name ?? "Tanpa kategori",
        walletId: e.wallet_id ?? null,
        walletName: e.wallet?.name ?? "-",
        categoryId: e.category_id ?? null,
        labelId: e.label_id ?? null,
        labelName: e.label?.name ?? null,
        labelColor: e.label?.color ?? null,
        description: e.description ?? "",
        amount: Number(e.amount),
        isPiutang: false,
      });
    }
  };
  pushExpense((opEx ?? []) as any[], "op");
  pushExpense((persEx ?? []) as any[], "personal");

  const walletOpts = ((wallets ?? []) as any[]).map((w) => ({ value: w.id, label: w.name }));
  const categoryOpts = ((categories ?? []) as any[]).map((c) => ({ value: c.id, label: c.name }));
  const labelOpts = ((labels ?? []) as any[]).map((l) => ({ value: l.id, label: l.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Riwayat Transaksi"
        description="Semua transaksi uang (penjualan, pembelian, pengeluaran operasional & pribadi) dalam satu halaman. Baris merah = piutang yang belum diterima."
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
