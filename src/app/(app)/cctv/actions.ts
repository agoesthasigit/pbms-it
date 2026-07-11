"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { success?: boolean; error?: string };

function getKey(): string | null {
  return process.env.CREDENTIALS_SECRET_KEY ?? null;
}

export async function upsertCctv(input: {
  id?: string | null;
  client_id: string;
  nvr_brand: string;
  channel_count: number;
  username?: string;
  password?: string;
  ip_address?: string;
  location?: string;
  notes?: string;
}): Promise<Result> {
  if (!input.client_id) return { error: "Pilih client." };
  if (!input.nvr_brand.trim()) return { error: "Merk NVR/DVR wajib diisi." };

  const key = getKey();
  if (!key) return { error: "CREDENTIALS_SECRET_KEY belum diset di environment." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_cctv_system", {
    p_id: input.id ?? null,
    p_client_id: input.client_id,
    p_nvr_brand: input.nvr_brand,
    p_channel_count: input.channel_count,
    p_username: input.username ?? "",
    p_password: input.password ?? "",
    p_ip_address: input.ip_address ?? "",
    p_location: input.location ?? "",
    p_notes: input.notes ?? "",
    p_key: key,
  });

  if (error) return { error: error.message || "Gagal menyimpan CCTV." };
  revalidatePath("/cctv");
  return { success: true };
}

export async function deleteCctv(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("cctv_systems").delete().eq("id", id);
  if (error) return { error: "Gagal menghapus CCTV." };
  revalidatePath("/cctv");
  return { success: true };
}
