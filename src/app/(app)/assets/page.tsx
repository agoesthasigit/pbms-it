import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { AssetManager, type AssetPhotoBrief } from "./asset-manager";
import type { Client, WalletWithBalance, Category } from "@/types/db";
import type { ClientAsset, RepairLog } from "@/types/phase5";

export const metadata = { title: "Asset Client" };

const BUCKET = "asset-photos";

export default async function AssetsPage() {
  const supabase = await createClient();

  const [
    { data: assets }, { data: clients }, { data: balances },
    { data: wallets }, { data: categories }, { data: repairs },
    { data: allPhotos },
  ] = await Promise.all([
    supabase.from("v_client_assets").select("*").order("warranty_end"),
    supabase.from("clients").select("*").eq("status", "active").order("company_name"),
    supabase.from("v_wallet_balances").select("*"),
    supabase.from("wallets").select("*").order("created_at"),
    supabase.from("categories").select("*")
      .eq("type", "operational_expense").eq("is_active", true).order("name"),
    supabase.from("repair_logs").select("*").eq("target", "asset")
      .order("repair_date", { ascending: false }),
    supabase.from("asset_photos").select("*").order("sort_order"),
  ]);

  const walletsMerged: WalletWithBalance[] = (wallets ?? []).map((w) => ({
    ...w,
    balance: Number(balances?.find((b) => b.id === w.id)?.balance ?? 0),
  }));

  const repairLogsByAsset: Record<string, RepairLog[]> = {};
  for (const r of (repairs ?? []) as RepairLog[]) {
    (repairLogsByAsset[r.target_id] ??= []).push(r);
  }

  // ringkasan foto per aset + signed URL untuk thumbnail pertama
  type PhotoRow = { asset_id: string; storage_path: string; file_size: number; sort_order: number };
  const grouped: Record<string, PhotoRow[]> = {};
  for (const p of (allPhotos ?? []) as PhotoRow[]) {
    (grouped[p.asset_id] ??= []).push(p);
  }

  const photoBrief: Record<string, AssetPhotoBrief> = {};
  await Promise.all(
    Object.entries(grouped).map(async ([assetId, rows]) => {
      const totalSize = rows.reduce((s, r) => s + (r.file_size ?? 0), 0);
      const first = rows[0];
      let firstUrl: string | null = null;
      if (first) {
        const { data } = await supabase.storage
          .from(BUCKET).createSignedUrl(first.storage_path, 60 * 60);
        firstUrl = data?.signedUrl ?? null;
      }
      photoBrief[assetId] = {
        asset_id: assetId, count: rows.length,
        first_url: firstUrl, total_size: totalSize,
      };
    })
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asset Client"
        description="Barang terjual otomatis menjadi asset dengan status garansi real-time. Bisa tambah foto & export PDF per client."
      />
      <AssetManager
        assets={(assets ?? []) as ClientAsset[]}
        clients={(clients ?? []) as Client[]}
        wallets={walletsMerged}
        categories={(categories ?? []) as Category[]}
        repairLogsByAsset={repairLogsByAsset}
        photoBrief={photoBrief}
      />
    </div>
  );
}
