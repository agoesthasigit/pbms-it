"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AcceptLine = {
  item_id: string;
  selling_price: number;
  warranty_months?: number;
};
export type DropshipLine = AcceptLine & {
  track_as_asset: boolean;
  is_active: boolean;
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

/**
 * Terima + langsung JUAL (dropship): create_purchase (hutang) LALU create_sale
 * dalam satu transaksi atomik. Untuk barang yang dikirim Line Art langsung ke
 * lokasi client (stok bersih 0). Kunci portal tetap hutang; sale_id hanya jejak.
 */
export async function acceptOrderDropship(input: {
  id: string;
  lines: DropshipLine[];
  client_id: string;
  sale_method: "monthly_invoice" | "cash" | "transfer";
  sale_wallet_id?: string | null;
  period_month?: string | null; // "YYYY-MM-01"
  brand: "cetak_ide" | "athaya";
  extra_notes?: string;
}): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_distributor_order_dropship", {
    p_order_id: input.id,
    p_lines: input.lines,
    p_client_id: input.client_id,
    p_sale_method: input.sale_method,
    p_sale_wallet_id: input.sale_wallet_id ?? null,
    p_period_month: input.period_month ?? null,
    p_brand: input.brand,
    p_extra_notes: input.extra_notes ?? null,
  });
  if (error) return { ok: false, error: msg(error.message) };
  revalidatePath("/distributor-orders");
  revalidatePath("/purchases");
  revalidatePath("/sales");
  revalidatePath("/invoices");
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
