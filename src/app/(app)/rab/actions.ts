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
};

export async function saveRab(input: {
  id?: string | null;
  client_id: string;
  project_name: string;
  project_date: string;
  status: RabStatus;
  notes?: string;
  items: RabItemInput[];
}): Promise<Result> {
  if (!input.client_id) return { error: "Pilih client." };
  if (!input.project_name.trim()) return { error: "Nama proyek wajib diisi." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_rab", {
    p_id: input.id ?? null,
    p_client_id: input.client_id,
    p_project_name: input.project_name,
    p_project_date: input.project_date,
    p_status: input.status,
    p_notes: input.notes ?? "",
    p_items: input.items.filter((i) => i.item_name.trim()),
  });

  if (error) return { error: error.message || "Gagal menyimpan RAB." };
  revalidatePath("/rab");
  return { success: true, rabId: data as string };
}

export async function deleteRab(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_rab", { p_id: id });
  if (error) return { error: error.message || "Gagal menghapus RAB." };
  revalidatePath("/rab");
  revalidatePath("/wallets");
  return { success: true };
}

export async function recordRabProfit(input: {
  id: string;
  wallet_id: string;
  date: string;
}): Promise<Result> {
  if (!input.wallet_id) return { error: "Pilih wallet." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_rab_profit", {
    p_id: input.id, p_wallet_id: input.wallet_id, p_date: input.date,
  });
  if (error) return { error: error.message || "Gagal mencatat laba." };
  revalidatePath("/rab");
  revalidatePath("/wallets");
  return { success: true };
}
