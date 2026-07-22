"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { success?: boolean; error?: string; count?: number };

// ---------- KONTRAK ----------
export async function saveContract(input: {
  id?: string | null;
  client_id: string;
  service_name: string;
  monthly_amount: number;
  start_date: string;
  due_day: number;
  is_active: boolean;
  notes?: string;
}): Promise<Result> {
  if (!input.client_id) return { error: "Client wajib dipilih." };
  if (!input.service_name.trim()) return { error: "Nama layanan wajib diisi." };
  if (input.monthly_amount <= 0) return { error: "Biaya bulanan harus lebih dari 0." };

  const supabase = await createClient();
  const payload = {
    client_id: input.client_id,
    service_name: input.service_name.trim(),
    monthly_amount: input.monthly_amount,
    start_date: input.start_date,
    due_day: input.due_day,
    is_active: input.is_active,
    notes: input.notes?.trim() || null,
  };

  const { error } = input.id
    ? await supabase.from("maintenance_contracts").update(payload).eq("id", input.id)
    : await supabase.from("maintenance_contracts").insert(payload);

  if (error) return { error: error.message || "Gagal menyimpan kontrak." };
  revalidatePath("/maintenance");
  return { success: true };
}

export async function deleteContract(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("maintenance_contracts").delete().eq("id", id);
  if (error) return { error: error.message || "Gagal menghapus kontrak." };
  revalidatePath("/maintenance");
  return { success: true };
}

// ---------- PENERBITAN TAGIHAN ----------
export async function issueCharges(input: {
  period: string; // YYYY-MM-01
  charges: { contract_id: string; amount: number }[];
}): Promise<Result> {
  if (input.charges.length === 0) return { error: "Pilih minimal 1 kontrak." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("issue_maintenance_charges", {
    p_period: input.period,
    p_charges: input.charges,
  });

  if (error) return { error: error.message || "Gagal menerbitkan tagihan." };
  revalidatePath("/maintenance");
  revalidatePath("/invoices");
  revalidatePath("/sales");
  return { success: true, count: Number(data ?? 0) };
}

export async function cancelCharge(saleId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_maintenance_charge", { p_sale_id: saleId });
  if (error) return { error: error.message || "Gagal membatalkan tagihan." };
  revalidatePath("/maintenance");
  revalidatePath("/invoices");
  revalidatePath("/sales");
  return { success: true };
}
