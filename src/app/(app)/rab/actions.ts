"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { RabStatus, RabItemType } from "@/types/phase7";

type Result = { success?: boolean; error?: string; rabId?: string };

export type RabItemInput = {
  item_type: RabItemType;
  item_name: string;
  qty: number;
  price: number;
  sort_order: number;
  paid_date?: string | null;
  paid_wallet_id?: string | null;
};

export type RabPaymentInput = {
  payment_date: string;
  description: string;
  amount: number;
  wallet_id: string;
  sort_order: number;
};

export async function saveRab(input: {
  id?: string | null;
  client_id: string;
  project_name: string;
  project_date: string;
  status: RabStatus;
  notes?: string;
  items: RabItemInput[];
  payments: RabPaymentInput[];
}): Promise<Result> {
  if (!input.client_id) return { error: "Pilih client." };
  if (!input.project_name.trim()) return { error: "Nama proyek wajib diisi." };

  const items = input.items.filter((i) => i.item_name.trim());
  const payments = input.payments.filter((p) => p.amount > 0);

  // validasi: termin wajib punya wallet
  const noWallet = payments.find((p) => !p.wallet_id);
  if (noWallet) {
    return { error: `Termin "${noWallet.description || "(tanpa keterangan)"}" wajib memilih wallet.` };
  }
  // validasi: pengeluaran yang punya wallet wajib punya tanggal
  const badExpense = items.find(
    (i) => i.item_type === "expense" && i.paid_wallet_id && !i.paid_date
  );
  if (badExpense) {
    return { error: `Pengeluaran "${badExpense.item_name}" sudah pilih wallet, tanggal bayar wajib diisi.` };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_rab", {
    p_id: input.id ?? null,
    p_client_id: input.client_id,
    p_project_name: input.project_name,
    p_project_date: input.project_date,
    p_status: input.status,
    p_notes: input.notes ?? "",
    p_items: items,
    p_payments: payments,
  });

  if (error) return { error: error.message || "Gagal menyimpan RAB." };
  revalidatePath("/rab");
  revalidatePath("/wallets");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  return { success: true, rabId: data as string };
}

export async function deleteRab(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_rab", { p_id: id });
  if (error) return { error: error.message || "Gagal menghapus RAB." };
  revalidatePath("/rab");
  revalidatePath("/wallets");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  return { success: true };
}
