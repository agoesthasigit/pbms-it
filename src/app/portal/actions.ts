"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type OrderItemInput = { name: string; qty: number; cost_price: number };
export type ActionResult = { ok: boolean; error?: string };

// Pesan exception dari RPC (RAISE EXCEPTION) sudah berbahasa Indonesia & jelas —
// teruskan apa adanya; fallback generik bila kosong.
function msg(m?: string): string {
  return m && m.trim() ? m : "Terjadi kesalahan. Coba lagi.";
}

/** Buat/ubah DRAFT pengajuan (id null = buat baru). */
export async function upsertOrder(input: {
  id: string | null;
  order_date: string;
  destination: string;
  items: OrderItemInput[];
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("portal_upsert_order", {
    p_order_id: input.id,
    p_order_date: input.order_date,
    p_destination: input.destination,
    p_items: input.items,
  });
  if (error) return { ok: false, error: msg(error.message) };
  revalidatePath("/portal");
  return { ok: true };
}

/** Hapus DRAFT pengajuan milik sendiri. */
export async function deleteOrder(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("portal_delete_order", { p_order_id: id });
  if (error) return { ok: false, error: msg(error.message) };
  revalidatePath("/portal");
  return { ok: true };
}
