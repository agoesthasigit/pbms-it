import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { SaleList } from "./sale-list";
import type { ProductWithStock, Client, WalletWithBalance } from "@/types/db";
import type { SaleRow } from "@/types/phase3";

export const metadata = { title: "Penjualan" };

export default async function SalesPage() {
  const supabase = await createClient();

  const [{ data: sales }, { data: products }, { data: clients }, { data: balances }, { data: wallets }] =
    await Promise.all([
      supabase.from("sales")
        .select("*, client:clients(company_name), wallet:wallets(name)")
        .order("sale_date", { ascending: false }),
      supabase.from("v_product_stock").select("*").eq("is_active", true).order("name"),
      supabase.from("clients").select("*").eq("status", "active").order("company_name"),
      supabase.from("v_wallet_balances").select("*"),
      supabase.from("wallets").select("*").order("created_at"),
    ]);

  const walletsMerged: WalletWithBalance[] = (wallets ?? []).map((w) => ({
    ...w,
    balance: Number(balances?.find((b) => b.id === w.id)?.balance ?? 0),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Penjualan Barang"
        description="Penjualan menurunkan stok dan otomatis membuat asset client dengan garansi."
      />
      <SaleList
        sales={(sales ?? []) as SaleRow[]}
        products={(products ?? []) as ProductWithStock[]}
        clients={(clients ?? []) as Client[]}
        wallets={walletsMerged}
      />
    </div>
  );
}
