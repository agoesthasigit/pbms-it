import { createClient } from "@/lib/supabase/server";
import { unwrap } from "@/lib/supabase/unwrap";
import { PageHeader } from "@/components/shared/page-header";
import { PurchaseList } from "./purchase-list";
import type { ProductWithStock, Distributor, WalletWithBalance, Client } from "@/types/db";
import type { PurchaseRow } from "@/types/phase3";

export const metadata = { title: "Pembelian" };

export default async function PurchasesPage() {
  const supabase = await createClient();

  // unwrap(...) → melempar bila query gagal (bukan menelan jadi daftar kosong).
  // Ini yang menangkap bug embed wallets ambigu 2026-08-22 secara LANTANG.
  const [pRes, prodRes, distRes, balRes, walRes, cliRes] =
    await Promise.all([
      supabase.from("purchases")
        // wallet:wallets!wallet_id → tegaskan FK, karena purchases kini punya 2 relasi
        // ke wallets (wallet_id & paid_wallet_id, dari fitur Hutang) → tanpa ini embed
        // ambigu, query gagal, dan seluruh daftar pembelian tampak kosong.
        .select("*, distributor:distributors(name), wallet:wallets!wallet_id(name), purchase_items(qty, price, product:products(name))")
        .order("purchase_date", { ascending: false }),
      supabase.from("v_product_stock").select("*").eq("is_active", true).order("name"),
      supabase.from("distributors").select("*").order("name"),
      supabase.from("v_wallet_balances").select("*"),
      supabase.from("wallets").select("*").order("created_at"),
      supabase.from("clients").select("*").eq("status", "active").order("company_name"),
    ]);

  const purchases = unwrap(pRes, "purchases");
  const products = unwrap(prodRes, "v_product_stock");
  const distributors = unwrap(distRes, "distributors");
  const balances = unwrap(balRes, "v_wallet_balances");
  const wallets = unwrap(walRes, "wallets");
  const clients = unwrap(cliRes, "clients");

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
        clients={(clients ?? []) as Client[]}
      />
    </div>
  );
}
