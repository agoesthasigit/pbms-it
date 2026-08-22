"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AcceptLine = {
  item_id: string;
  selling_price: number;
  warranty_months?: number;
};
export type Result = { ok: boolean; error?: string };

function msg(m?: string): string {
  return m && m.trim() ? m : "Terjadi kesalahan. Coba lagi.";
}

/** Terima pengajuan → jadi pembelian hutang (create_purchase di sesi pemilik). */
export async function acceptOrder(input: {
  id: string;
  lines: AcceptLine[];
  extra_notes?: string;
}): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_distributor_order", {
    p_order_id: input.id,
    p_lines: input.lines,
    p_extra_notes: input.extra_notes ?? null,
  });
  if (error) return { ok: false, error: msg(error.message) };
  revalidatePath("/distributor-orders");
  revalidatePath("/purchases");
  return { ok: true };
}

/** Batal Terima → balik ke draft (guard: belum terjual & hutang belum dibayar). */
export async function unacceptOrder(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("unaccept_distributor_order", { p_order_id: id });
  if (error) return { ok: false, error: msg(error.message) };
  revalidatePath("/distributor-orders");
  revalidatePath("/purchases");
  return { ok: true };
}

/** Tolak draft mentah. */
export async function rejectOrder(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_distributor_order", { p_order_id: id });
  if (error) return { ok: false, error: msg(error.message) };
  revalidatePath("/distributor-orders");
  return { ok: true };
}
