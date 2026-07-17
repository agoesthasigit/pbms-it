import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { RabEditor } from "../rab-editor";
import type { Client, WalletWithBalance } from "@/types/db";
import {
  type RabProject, type RabItem, type RabPayment, type RabStatus,
  RAB_STATUS_LABELS, RAB_STATUS_STYLE,
} from "@/types/phase7";
import { formatIDR } from "@/lib/utils/currency";

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

  const [{ data: items }, { data: payments }, { data: clients }, { data: balances }, { data: rawWallets }] =
    await Promise.all([
      supabase.from("rab_items").select("*").eq("rab_id", id).order("sort_order"),
      supabase.from("rab_payments").select("*").eq("rab_id", id).order("payment_date"),
      supabase.from("clients").select("*").eq("status", "active").order("company_name"),
      supabase.from("v_wallet_balances").select("*"),
      supabase.from("wallets").select("*").order("created_at"),
    ]);

  const wallets: WalletWithBalance[] = (rawWallets ?? []).map((w) => ({
    ...w,
    balance: Number(balances?.find((b) => b.id === w.id)?.balance ?? 0),
  }));

  const proj = project as RabProject;
  const st = proj.status as RabStatus;
  const remaining = Number(proj.remaining ?? 0);
  const lunas = Number(proj.grand_total_rab ?? 0) > 0 && remaining <= 0;

  return (
    <div className="space-y-6">
      <PageHeader title={proj.project_name}
        description={`${proj.company_name} · Laba: ${formatIDR(Number(proj.net_profit ?? 0))}`}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={RAB_STATUS_STYLE[st]}>{RAB_STATUS_LABELS[st]}</Badge>
          {lunas ? (
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Lunas</Badge>
          ) : (
            <Badge variant="outline" className="text-amber-700">
              Sisa {formatIDR(Math.max(remaining, 0))}
            </Badge>
          )}
          <Button variant="outline" nativeButton={false}
            render={<a href={`/api/rab/${id}/pdf`} target="_blank" rel="noopener noreferrer" />}>
            <Download className="h-4 w-4" /> Unduh PDF
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/rab" />}>
            <ArrowLeft className="h-4 w-4" /> Kembali
          </Button>
        </div>
      </PageHeader>

      <RabEditor
        clients={(clients ?? []) as Client[]}
        wallets={wallets}
        existing={proj}
        existingItems={(items ?? []) as RabItem[]}
        existingPayments={(payments ?? []) as RabPayment[]}
      />
    </div>
  );
}
