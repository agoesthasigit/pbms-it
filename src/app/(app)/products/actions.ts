"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { success?: boolean; error?: string };

export type ProductInput = {
  name: string;
  sku?: string;
  category_id?: string | null;
  unit: string;
  default_selling_price: number;
  min_stock: number;
  default_warranty_months: number;
  is_active?: boolean;
};

function clean(input: ProductInput) {
  return {
    name: input.name.trim(),
    sku: input.sku?.trim() || null,
    category_id: input.category_id || null,
    unit: input.unit.trim() || "pcs",
    default_selling_price: input.default_selling_price || 0,
    min_stock: input.min_stock || 0,
    default_warranty_months: input.default_warranty_months ?? 12,
    is_active: input.is_active ?? true,
  };
}

export async function addProduct(input: ProductInput): Promise<Result> {
  if (!input.name.trim()) return { error: "Nama barang wajib diisi." };
  const supabase = await createClient();
  const { error } = await supabase.from("products").insert(clean(input));
  if (error) return { error: "Gagal menambah barang." };
  revalidatePath("/products");
  return { success: true };
}

export async function updateProduct(
  id: string,
  input: ProductInput
): Promise<Result> {
  if (!input.name.trim()) return { error: "Nama barang wajib diisi." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update(clean(input))
    .eq("id", id);
  if (error) return { error: "Gagal mengubah barang." };
  revalidatePath("/products");
  return { success: true };
}

export async function deleteProduct(id: string): Promise<Result> {
  const supabase = await createClient();

  // Guard BR-03: barang yang sudah punya pergerakan stok tidak boleh dihapus
  const { count } = await supabase
    .from("stock_movements")
    .select("id", { count: "exact", head: true })
    .eq("product_id", id);

  if ((count ?? 0) > 0) {
    return {
      error:
        "Barang sudah punya riwayat stok/transaksi dan tidak bisa dihapus. Nonaktifkan saja.",
    };
  }

  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return { error: "Barang sudah dipakai transaksi. Nonaktifkan saja." };
    }
    return { error: "Gagal menghapus barang." };
  }
  revalidatePath("/products");
  return { success: true };
}

export async function adjustStock(input: {
  product_id: string;
  qty: number; // positif = tambah, negatif = kurang
  note: string;
}): Promise<Result> {
  const { product_id, qty, note } = input;
  if (!qty || qty === 0) return { error: "Jumlah penyesuaian tidak boleh 0." };
  if (!note.trim())
    return { error: "Alasan penyesuaian wajib diisi (untuk audit)." };

  const supabase = await createClient();

  // BR-04: stok tidak boleh minus setelah penyesuaian
  const { data: prod } = await supabase
    .from("v_product_stock")
    .select("name, current_stock")
    .eq("id", product_id)
    .single();

  if (!prod) return { error: "Barang tidak ditemukan." };
  const after = Number(prod.current_stock) + qty;
  if (after < 0) {
    return {
      error: `Stok "${prod.name}" saat ini ${prod.current_stock}. Penyesuaian ini membuat stok minus.`,
    };
  }

  const { error } = await supabase.from("stock_movements").insert({
    product_id,
    type: "adjustment",
    qty,
    note: note.trim(),
  });

  if (error) return { error: "Gagal menyimpan penyesuaian stok." };
  revalidatePath("/products");
  return { success: true };
}
