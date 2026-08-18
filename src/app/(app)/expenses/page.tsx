import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import {
  ExpensesManager,
  type MergedExpenseRow,
} from "@/components/shared/expenses-manager";
import type { WalletWithBalance, Category, Label } from "@/types/db";
import type { ExpenseRow } from "@/types/phase3";

export const metadata = { title: "Pengeluaran" };

export default async function ExpensesPage() {
  const supabase = await createClient();

  const SELECT = "*, wallet:wallets(name), category:categories(name), label:labels(name,color)";
  const [
    { data: opExp }, { data: prExp },
    { data: balances }, { data: wallets },
    { data: catOp }, { data: catPersonal }, { data: labels },
  ] = await Promise.all([
    supabase.from("operational_expenses").select(SELECT).order("expense_date", { ascending: false }),
    supabase.from("personal_expenses").select(SELECT).order("expense_date", { ascending: false }),
    supabase.from("v_wallet_balances").select("*"),
    supabase.from("wallets").select("*").order("created_at"),
    supabase.from("categories").select("*").eq("type", "operational_expense").eq("is_active", true).order("name"),
    supabase.from("categories").select("*").eq("type", "personal_expense").eq("is_active", true).order("name"),
    supabase.from("labels").select("*").order("name"),
  ]);

  // Gabungkan kedua tabel jadi satu daftar + tandai jenisnya, urut terbaru dulu.
  const merged: MergedExpenseRow[] = [
    ...((opExp ?? []) as ExpenseRow[]).map((e) => ({ ...e, kind: "operational" as const })),
    ...((prExp ?? []) as ExpenseRow[]).map((e) => ({ ...e, kind: "personal" as const })),
  ].sort((a, b) => (a.expense_date < b.expense_date ? 1 : a.expense_date > b.expense_date ? -1 : 0));

  const walletsMerged: WalletWithBalance[] = (wallets ?? []).map((w) => ({
    ...w,
    balance: Number(balances?.find((b) => b.id === w.id)?.balance ?? 0),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengeluaran"
        description="Semua pengeluaran operasional & pribadi dalam satu daftar. Pilih jenis saat mencatat; hanya operasional yang mengurangi laba usaha."
      />
      <ExpensesManager
        expenses={merged}
        wallets={walletsMerged}
        categoriesOp={(catOp ?? []) as Category[]}
        categoriesPersonal={(catPersonal ?? []) as Category[]}
        labels={(labels ?? []) as Label[]}
      />
    </div>
  );
}
