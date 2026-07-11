import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { PurchaseList } from "./purchase-list";
import type { ProductWithStock, Distributor, WalletWithBalance } from "@/types/db";
import type { PurchaseRow } from "@/types/phase3";

export const metadata = { title: "Pembelian" };

export default async function PurchasesPage() {
  const supabase = await createClient();

  const [{ data: purchases }, { data: products }, { data: distributors }, { data: balances }, { data: wallets }] =
    await Promise.all([
      supabase.from("purchases")
        .select("*, distributor:distributors(name), wallet:wallets(name)")
        .order("purchase_date", { ascending: false }),
      supabase.from("v_product_stock").select("*").eq("is_active", true).order("name"),
      supabase.from("distributors").select("*").order("name"),
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
        title="Pembelian Barang"
        description="Setiap pembelian menambah stok dan mengurangi saldo wallet secara otomatis."
      />
      <PurchaseList
        purchases={(purchases ?? []) as PurchaseRow[]}
        products={(products ?? []) as ProductWithStock[]}
        distributors={(distributors ?? []) as Distributor[]}
        wallets={walletsMerged}
      />
    </div>
  );
}
