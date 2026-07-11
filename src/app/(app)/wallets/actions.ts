"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { WalletType } from "@/types/db";

type Result = { success?: boolean; error?: string };

export type WalletInput = {
  name: string;
  type: WalletType;
  initial_balance: number;
  is_active?: boolean;
};

export async function addWallet(input: WalletInput): Promise<Result> {
  if (!input.name.trim()) return { error: "Nama wallet wajib diisi." };
  const supabase = await createClient();
  const { error } = await supabase.from("wallets").insert({
    name: input.name.trim(),
    type: input.type,
    initial_balance: input.initial_balance || 0,
  });
  if (error) return { error: "Gagal menambah wallet." };
  revalidatePath("/wallets");
  return { success: true };
}

export async function updateWallet(
  id: string,
  input: WalletInput
): Promise<Result> {
  if (!input.name.trim()) return { error: "Nama wallet wajib diisi." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("wallets")
    .update({
      name: input.name.trim(),
      type: input.type,
      initial_balance: input.initial_balance || 0,
      is_active: input.is_active ?? true,
    })
    .eq("id", id);
  if (error) return { error: "Gagal mengubah wallet." };
  revalidatePath("/wallets");
  return { success: true };
}

export async function deleteWallet(id: string): Promise<Result> {
  const supabase = await createClient();

  // Guard BR-12: wallet yang sudah punya transaksi tidak boleh dihapus
  const { count } = await supabase
    .from("wallet_transactions")
    .select("id", { count: "exact", head: true })
    .eq("wallet_id", id);

  if ((count ?? 0) > 0) {
    return {
      error:
        "Wallet sudah punya riwayat transaksi dan tidak bisa dihapus. Nonaktifkan saja.",
    };
  }

  const { error } = await supabase.from("wallets").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return {
        error: "Wallet sudah dipakai data lain. Nonaktifkan saja.",
      };
    }
    return { error: "Gagal menghapus wallet." };
  }
  revalidatePath("/wallets");
  return { success: true };
}

export async function transferBetweenWallets(input: {
  from_id: string;
  to_id: string;
  amount: number;
  tx_date: string;
  description?: string;
}): Promise<Result> {
  const { from_id, to_id, amount, tx_date, description } = input;

  if (!from_id || !to_id) return { error: "Pilih wallet asal dan tujuan." };
  if (from_id === to_id)
    return { error: "Wallet asal dan tujuan tidak boleh sama." };
  if (!amount || amount <= 0) return { error: "Nominal harus lebih dari 0." };

  const supabase = await createClient();

  // Validasi saldo cukup (server-side)
  const { data: fromWallet } = await supabase
    .from("v_wallet_balances")
    .select("name, balance")
    .eq("id", from_id)
    .single();

  if (!fromWallet) return { error: "Wallet asal tidak ditemukan." };
  if (Number(fromWallet.balance) < amount)
    return { error: `Saldo ${fromWallet.name} tidak cukup.` };

  const { data: toWallet } = await supabase
    .from("wallets")
    .select("name")
    .eq("id", to_id)
    .single();

  const { error } = await supabase.from("wallet_transactions").insert([
    {
      wallet_id: from_id,
      type: "transfer_out",
      amount,
      tx_date,
      ref_type: "transfer",
      description: description || `Transfer ke ${toWallet?.name ?? "-"}`,
    },
    {
      wallet_id: to_id,
      type: "transfer_in",
      amount,
      tx_date,
      ref_type: "transfer",
      description: description || `Transfer dari ${fromWallet.name}`,
    },
  ]);

  if (error) return { error: "Gagal melakukan transfer." };
  revalidatePath("/wallets");
  return { success: true };
}
