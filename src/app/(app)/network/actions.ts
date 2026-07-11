"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { success?: boolean; error?: string };
function getKey(): string | null { return process.env.CREDENTIALS_SECRET_KEY ?? null; }

export async function upsertNetwork(input: {
  id?: string | null;
  client_id: string;
  ssid: string;
  wifi_password?: string;   // password WiFi (SSID)
  username?: string;        // username perangkat
  password?: string;        // password perangkat
  device_name?: string;
  ip_address?: string;
  location?: string;
  notes?: string;
}): Promise<Result> {
  if (!input.client_id) return { error: "Pilih client." };
  if (!input.ssid.trim()) return { error: "Nama WiFi (SSID) wajib diisi." };
  const key = getKey();
  if (!key) return { error: "CREDENTIALS_SECRET_KEY belum diset di environment." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_network_credential", {
    p_id: input.id ?? null,
    p_client_id: input.client_id,
    p_ssid: input.ssid,
    p_wifi_password: input.wifi_password ?? "",
    p_username: input.username ?? "",
    p_password: input.password ?? "",
    p_device_name: input.device_name ?? "",
    p_ip_address: input.ip_address ?? "",
    p_location: input.location ?? "",
    p_notes: input.notes ?? "",
    p_key: key,
  });
  if (error) return { error: error.message || "Gagal menyimpan credential." };
  revalidatePath("/network");
  return { success: true };
}

export async function deleteNetwork(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("network_credentials").delete().eq("id", id);
  if (error) return { error: "Gagal menghapus credential." };
  revalidatePath("/network");
  return { success: true };
}
