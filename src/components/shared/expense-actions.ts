"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { success?: boolean; error?: string };
type Kind = "operational" | "personal";

const TABLE: Record<Kind, string> = {
  operational: "operational_expenses",
  personal: "personal_expenses",
};

export type ExpenseInput = {
  wallet_id: string;
  category_id: string | null;
  label_id: string | null;
  expense_date: string;
  amount: number;
  description?: string;
};

const refType = (kind: Kind) =>
  kind === "operational" ? "op_expense" : "personal_expense";

export async function createExpense(
  kind: Kind,
  input: ExpenseInput
): Promise<Result> {
  if (!input.wallet_id) return { error: "Pilih wallet." };
  if (!input.amount || input.amount <= 0)
    return { error: "Nominal harus lebih dari 0." };

  const supabase = await createClient();

  // 1. simpan expense
  const { data: exp, error: e1 } = await supabase
    .from(TABLE[kind])
    .insert({
      wallet_id: input.wallet_id,
      category_id: input.category_id,
      label_id: input.label_id,
      expense_date: input.expense_date,
      amount: input.amount,
      description: input.description?.trim() || null,
    })
    .select("id")
    .single();

  if (e1 || !exp) return { error: "Gagal menyimpan pengeluaran." };

  // 2. wallet keluar (BR-02). Pengeluaran pribadi TETAP mengurangi wallet (BR-08),
  //    tapi nanti tidak dihitung di laba bisnis (diproses di laporan Phase 8).
  const { error: e2 } = await supabase.from("wallet_transactions").insert({
    wallet_id: input.wallet_id,
    type: "expense",
    amount: input.amount,
    tx_date: input.expense_date,
    ref_type: refType(kind),
    ref_id: exp.id,
    description:
      input.description?.trim() ||
      (kind === "operational" ? "Pengeluaran operasional" : "Pengeluaran pribadi"),
  });

  if (e2) {
    // rollback manual expense bila wallet tx gagal
    await supabase.from(TABLE[kind]).delete().eq("id", exp.id);
    return { error: "Gagal mencatat transaksi wallet." };
  }

  revalidatePath(`/expenses/${kind}`);
  revalidatePath("/wallets");
  return { success: true };
}

export async function deleteExpense(
  kind: Kind,
  id: string
): Promise<Result> {
  const supabase = await createClient();

  const { error: e1 } = await supabase
    .from("wallet_transactions")
    .delete()
    .eq("ref_type", refType(kind))
    .eq("ref_id", id);
  if (e1) return { error: "Gagal menghapus transaksi wallet." };

  const { error: e2 } = await supabase.from(TABLE[kind]).delete().eq("id", id);
  if (e2) return { error: "Gagal menghapus pengeluaran." };

  revalidatePath(`/expenses/${kind}`);
  revalidatePath("/wallets");
  return { success: true };
}
