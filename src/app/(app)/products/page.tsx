import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { ProductManager } from "./product-manager";
import type { ProductWithStock, Category } from "@/types/db";

export const metadata = { title: "Stok Barang" };

export default async function ProductsPage() {
  const supabase = await createClient();

  // ambil SEMUA barang (untuk toggle "tampilkan stok habis"),
  // default UI hanya menampilkan yang stok > 0
  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase.from("v_product_stock").select("*").order("name"),
    supabase.from("categories").select("*")
      .eq("type", "product").eq("is_active", true).order("name"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stok Barang"
        description="Menampilkan barang yang masih ada stok. Barang yang habis terjual otomatis tersembunyi."
      />
      <ProductManager
        products={(products ?? []) as ProductWithStock[]}
        categories={(categories ?? []) as Category[]}
      />
    </div>
  );
}
