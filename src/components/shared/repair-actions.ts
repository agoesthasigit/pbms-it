"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { RepairTarget } from "@/types/phase5";

type Result = { success?: boolean; error?: string };

export async function addRepairLog(input: {
  target: RepairTarget;
  target_id: string;
  client_id: string;
  repair_date: string;
  problem: string;
  action_taken?: string;
  cost?: number;
  notes?: string;
  wallet_id?: string | null;    // isi jika ingin catat biaya ke keuangan
  category_id?: string | null;
}): Promise<Result> {
  if (!input.problem.trim()) return { error: "Deskripsi masalah wajib diisi." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_repair_log", {
    p_target: input.target,
    p_target_id: input.target_id,
    p_client_id: input.client_id,
    p_repair_date: input.repair_date,
    p_problem: input.problem,
    p_action: input.action_taken ?? "",
    p_cost: input.cost ?? 0,
    p_notes: input.notes ?? "",
    p_wallet_id: input.wallet_id ?? null,
    p_category_id: input.category_id ?? null,
  });

  if (error) return { error: error.message || "Gagal menyimpan log perbaikan." };
  revalidatePath("/assets");
  revalidatePath("/network");
  revalidatePath("/cctv");
  revalidatePath("/wallets");
  return { success: true };
}

export async function deleteRepairLog(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_repair_log", { p_id: id });
  if (error) return { error: error.message || "Gagal menghapus log." };
  revalidatePath("/assets");
  revalidatePath("/network");
  revalidatePath("/cctv");
  return { success: true };
}
