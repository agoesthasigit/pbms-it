import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { RabEditor } from "../rab-editor";
import { RabProfitButton } from "./profit-button";
import type { Client, WalletWithBalance } from "@/types/db";
import type { RabProject, RabItem } from "@/types/phase7";

export const metadata = { title: "Detail RAB" };

export default async function RabDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("v_rab_summary").select("*").eq("id", id).single();
  if (!project) notFound();

  const [{ data: items }, { data: clients }, { data: balances }, { data: rawWallets }, { data: profitTx }] =
    await Promise.all([
      supabase.from("rab_items").select("*").eq("rab_id", id).order("sort_order"),
      supabase.from("clients").select("*").eq("status", "active").order("company_name"),
      supabase.from("v_wallet_balances").select("*"),
      supabase.from("wallets").select("*").order("created_at"),
      supabase.from("wallet_transactions").select("id")
        .eq("ref_type", "rab").eq("ref_id", id).limit(1),
    ]);

  const wallets: WalletWithBalance[] = (rawWallets ?? []).map((w) => ({
    ...w,
    balance: Number(balances?.find((b) => b.id === w.id)?.balance ?? 0),
  }));

  const proj = project as RabProject;
  const profitRecorded = (profitTx ?? []).length > 0;

  return (
    <div className="space-y-6">
      <PageHeader title={proj.project_name}
        description={`${proj.company_name} · Laba: ${new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(proj.net_profit ?? 0))}`}>
        <div className="flex gap-2">
          <Button variant="outline" nativeButton={false}
            render={<a href={`/api/rab/${id}/pdf`} target="_blank" rel="noopener noreferrer" />}>
            <Download className="h-4 w-4" /> Unduh PDF
          </Button>
          <RabProfitButton rabId={id} wallets={wallets}
            netProfit={Number(proj.net_profit ?? 0)}
            status={proj.status} alreadyRecorded={profitRecorded} />
          <Button variant="outline" nativeButton={false} render={<Link href="/rab" />}>
            <ArrowLeft className="h-4 w-4" /> Kembali
          </Button>
        </div>
      </PageHeader>

      <RabEditor
        clients={(clients ?? []) as Client[]}
        existing={proj}
        existingItems={(items ?? []) as RabItem[]}
      />
    </div>
  );
}
