import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { NetworkManager } from "./network-manager";
import type { Client, WalletWithBalance, Category } from "@/types/db";
import type { NetworkCredential } from "@/types/phase6";
import type { RepairLog } from "@/types/phase5";

export const metadata = { title: "Network Client" };

export default async function NetworkPage() {
  const supabase = await createClient();

  const [
    { data: items }, { data: clients }, { data: balances },
    { data: wallets }, { data: categories }, { data: repairs },
  ] = await Promise.all([
    supabase.from("v_network_credentials")
      .select("*, client:clients(company_name)").order("created_at", { ascending: false }),
    supabase.from("clients").select("*").eq("status", "active").order("company_name"),
    supabase.from("v_wallet_balances").select("*"),
    supabase.from("wallets").select("*").order("created_at"),
    supabase.from("categories").select("*")
      .eq("type", "operational_expense").eq("is_active", true).order("name"),
    supabase.from("repair_logs").select("*").eq("target", "network")
      .order("repair_date", { ascending: false }),
  ]);

  const walletsMerged: WalletWithBalance[] = (wallets ?? []).map((w) => ({
    ...w,
    balance: Number(balances?.find((b) => b.id === w.id)?.balance ?? 0),
  }));

  const normalized: NetworkCredential[] = (items ?? []).map((n) => ({
    ...n,
    company_name: (n.client as unknown as { company_name?: string })?.company_name,
  }));

  const repairLogsByTarget: Record<string, RepairLog[]> = {};
  for (const r of (repairs ?? []) as RepairLog[]) {
    (repairLogsByTarget[r.target_id] ??= []).push(r);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Credentials Network Client"
        description="Data WiFi tiap client. Password disimpan terenkripsi dan hanya tampil saat Anda memintanya."
      />
      <NetworkManager
        items={normalized}
        clients={(clients ?? []) as Client[]}
        wallets={walletsMerged}
        categories={(categories ?? []) as Category[]}
        repairLogsByTarget={repairLogsByTarget}
      />
    </div>
  );
}
