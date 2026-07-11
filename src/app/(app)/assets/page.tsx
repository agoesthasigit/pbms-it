import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { AssetManager } from "./asset-manager";
import type { Client, WalletWithBalance, Category } from "@/types/db";
import type { ClientAsset, RepairLog } from "@/types/phase5";

export const metadata = { title: "Asset Client" };

export default async function AssetsPage() {
  const supabase = await createClient();

  const [
    { data: assets }, { data: clients }, { data: balances },
    { data: wallets }, { data: categories }, { data: repairs },
  ] = await Promise.all([
    supabase.from("v_client_assets").select("*").order("warranty_end"),
    supabase.from("clients").select("*").eq("status", "active").order("company_name"),
    supabase.from("v_wallet_balances").select("*"),
    supabase.from("wallets").select("*").order("created_at"),
    supabase.from("categories").select("*")
      .eq("type", "operational_expense").eq("is_active", true).order("name"),
    supabase.from("repair_logs").select("*").eq("target", "asset")
      .order("repair_date", { ascending: false }),
  ]);

  const walletsMerged: WalletWithBalance[] = (wallets ?? []).map((w) => ({
    ...w,
    balance: Number(balances?.find((b) => b.id === w.id)?.balance ?? 0),
  }));

  // kelompokkan repair logs per target_id (asset id)
  const repairLogsByAsset: Record<string, RepairLog[]> = {};
  for (const r of (repairs ?? []) as RepairLog[]) {
    (repairLogsByAsset[r.target_id] ??= []).push(r);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asset Client"
        description="Barang yang terjual otomatis menjadi asset client dengan status garansi real-time."
      />
      <AssetManager
        assets={(assets ?? []) as ClientAsset[]}
        clients={(clients ?? []) as Client[]}
        wallets={walletsMerged}
        categories={(categories ?? []) as Category[]}
        repairLogsByAsset={repairLogsByAsset}
      />
    </div>
  );
}
