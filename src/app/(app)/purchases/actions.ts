"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { success?: boolean; error?: string };

export type PurchaseItemInput = {
  name: string;
  qty: number;
  price: number;
  selling_price?: number;   // opsional, untuk produk baru
  warranty_months?: number; // opsional
  unit?: string;            // opsional
};

export async function createPurchase(input: {
  distributor_id: string | null;
  wallet_id: string;
  purchase_date: string;
  invoice_no?: string;
  notes?: string;
  items: PurchaseItemInput[];
}): Promise<Result> {
  if (!input.wallet_id) return { error: "Pilih wallet pembayar." };
  const valid = input.items.filter((i) => i.name.trim() && i.qty > 0);
  if (valid.length === 0) return { error: "Tambahkan minimal 1 barang." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_purchase", {
    p_distributor_id: input.distributor_id,
    p_wallet_id: input.wallet_id,
    p_purchase_date: input.purchase_date,
    p_invoice_no: input.invoice_no ?? "",
    p_notes: input.notes ?? "",
    p_items: valid.map((i) => ({
      name: i.name.trim(),
      qty: i.qty,
      price: i.price,
      selling_price: i.selling_price ?? "",
      warranty_months: i.warranty_months ?? "",
      unit: i.unit ?? "",
    })),
  });

  if (error) return { error: error.message || "Gagal menyimpan pembelian." };
  revalidatePath("/purchases");
  revalidatePath("/products");
  revalidatePath("/wallets");
  return { success: true };
}

export async function deletePurchase(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_purchase", { p_id: id });
  if (error) return { error: error.message || "Gagal menghapus pembelian." };
  revalidatePath("/purchases");
  revalidatePath("/products");
  revalidatePath("/wallets");
  return { success: true };
}
