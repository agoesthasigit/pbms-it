"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PaymentMethod } from "@/types/phase3";

type Result = { success?: boolean; error?: string };

export type SaleItemInput = {
  product_id: string;
  qty: number;
  price: number;
  warranty_months: number;
  serial_number?: string;
};

export async function createSale(input: {
  client_id: string;
  wallet_id: string | null;
  sale_date: string;
  payment_method: PaymentMethod;
  notes?: string;
  items: SaleItemInput[];
  period_month?: string | null;   // untuk piutang
  due_date?: string | null;       // untuk piutang
}): Promise<Result> {
  if (!input.client_id) return { error: "Pilih client." };
  if (input.payment_method === "cash" && !input.wallet_id)
    return { error: "Penjualan tunai wajib memilih wallet." };
  if (input.payment_method === "monthly_invoice" && !input.period_month)
    return { error: "Penjualan invoice wajib memilih periode." };
  const valid = input.items.filter((i) => i.product_id && i.qty > 0);
  if (valid.length === 0) return { error: "Tambahkan minimal 1 barang." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_sale", {
    p_client_id: input.client_id,
    p_wallet_id: input.payment_method === "cash" ? input.wallet_id : null,
    p_sale_date: input.sale_date,
    p_payment_method: input.payment_method,
    p_notes: input.notes ?? "",
    p_items: valid,
    p_period_month: input.payment_method === "monthly_invoice"
      ? `${input.period_month}-01` : null,
    p_due_date: input.payment_method === "monthly_invoice"
      ? (input.due_date || null) : null,
  });

  if (error) return { error: error.message || "Gagal menyimpan penjualan." };
  revalidatePath("/sales");
  revalidatePath("/products");
  revalidatePath("/wallets");
  revalidatePath("/assets");
  revalidatePath("/invoices");
  return { success: true };
}

export async function deleteSale(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_sale", { p_id: id });
  if (error) return { error: error.message || "Gagal menghapus penjualan." };
  revalidatePath("/sales");
  revalidatePath("/products");
  revalidatePath("/wallets");
  revalidatePath("/assets");
  revalidatePath("/invoices");
  return { success: true };
}
