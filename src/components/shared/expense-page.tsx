import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { ExpenseManager } from "@/components/shared/expense-manager";
import type { WalletWithBalance, Category, Label } from "@/types/db";
import type { ExpenseRow } from "@/types/phase3";

type Kind = "operational" | "personal";

const CONFIG: Record<Kind, {
  table: string; categoryType: string; title: string; description: string;
}> = {
  operational: {
    table: "operational_expenses",
    categoryType: "operational_expense",
    title: "Pengeluaran Operasional",
    description: "Biaya operasional bisnis. Ikut dihitung dalam laba bersih usaha.",
  },
  personal: {
    table: "personal_expenses",
    categoryType: "personal_expense",
    title: "Pengeluaran Pribadi",
    description: "Pengeluaran pribadi. Mengurangi saldo wallet, TAPI tidak mengurangi laba bisnis.",
  },
};

export async function ExpensePage({ kind }: { kind: Kind }) {
  const cfg = CONFIG[kind];
  const supabase = await createClient();

  const [{ data: expenses }, { data: balances }, { data: wallets }, { data: categories }, { data: labels }] =
    await Promise.all([
      supabase.from(cfg.table)
        .select("*, wallet:wallets(name), category:categories(name), label:labels(name,color)")
        .order("expense_date", { ascending: false }),
      supabase.from("v_wallet_balances").select("*"),
      supabase.from("wallets").select("*").order("created_at"),
      supabase.from("categories").select("*")
        .eq("type", cfg.categoryType).eq("is_active", true).order("name"),
      supabase.from("labels").select("*").order("name"),
    ]);

  const walletsMerged: WalletWithBalance[] = (wallets ?? []).map((w) => ({
    ...w,
    balance: Number(balances?.find((b) => b.id === w.id)?.balance ?? 0),
  }));

  return (
    <div className="space-y-6">
      <PageHeader title={cfg.title} description={cfg.description} />
      <ExpenseManager
        kind={kind}
        expenses={(expenses ?? []) as ExpenseRow[]}
        wallets={walletsMerged}
        categories={(categories ?? []) as Category[]}
        labels={(labels ?? []) as Label[]}
      />
    </div>
  );
}
