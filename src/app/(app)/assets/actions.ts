"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { success?: boolean; error?: string };

export async function addManualAsset(input: {
  client_id: string;
  product_name: string;
  serial_number?: string;
  purchase_date: string;
  warranty_months: number;
  notes?: string;
}): Promise<Result> {
  if (!input.client_id) return { error: "Pilih client." };
  if (!input.product_name.trim()) return { error: "Nama barang wajib diisi." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_manual_asset", {
    p_client_id: input.client_id,
    p_product_name: input.product_name,
    p_serial: input.serial_number ?? "",
    p_purchase_date: input.purchase_date,
    p_warranty_months: input.warranty_months,
    p_notes: input.notes ?? "",
  });

  if (error) return { error: error.message || "Gagal menambah asset." };
  revalidatePath("/assets");
  return { success: true };
}

export async function updateAsset(id: string, input: {
  product_name: string;
  serial_number?: string;
  purchase_date: string;
  warranty_end: string;
  notes?: string;
}): Promise<Result> {
  if (!input.product_name.trim()) return { error: "Nama barang wajib diisi." };
  const supabase = await createClient();
  const { error } = await supabase.from("client_assets").update({
    product_name: input.product_name.trim(),
    serial_number: input.serial_number?.trim() || null,
    purchase_date: input.purchase_date,
    warranty_end: input.warranty_end,
    notes: input.notes?.trim() || null,
  }).eq("id", id);
  if (error) return { error: "Gagal mengubah asset." };
  revalidatePath("/assets");
  return { success: true };
}

export async function deleteAsset(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("client_assets").delete().eq("id", id);
  if (error) return { error: "Gagal menghapus asset." };
  revalidatePath("/assets");
  return { success: true };
}
