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
        // wallet:wallets!wallet_id → tegaskan FK yang dipakai, karena sales kini
        // punya 2 relasi ke wallets (wallet_id & paid_wallet_id) → hindari ambiguitas embed
        .select("*, client:clients(company_name, email), wallet:wallets!wallet_id(name)")
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
