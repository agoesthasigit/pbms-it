import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { RabEditor } from "../rab-editor";
import type { Client, WalletWithBalance } from "@/types/db";

export const metadata = { title: "RAB Baru" };

export default async function NewRabPage() {
  const supabase = await createClient();

  const [{ data: clients }, { data: balances }, { data: rawWallets }] = await Promise.all([
    supabase.from("clients").select("*").eq("status", "active").order("company_name"),
    supabase.from("v_wallet_balances").select("*"),
    supabase.from("wallets").select("*").order("created_at"),
  ]);

  const wallets: WalletWithBalance[] = (rawWallets ?? []).map((w) => ({
    ...w,
    balance: Number(balances?.find((b) => b.id === w.id)?.balance ?? 0),
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="RAB Baru"
        description="Susun penawaran, catat pengeluaran & termin pembayaran proyek.">
        <Button variant="outline" nativeButton={false} render={<Link href="/rab" />}>
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Button>
      </PageHeader>
      <RabEditor clients={(clients ?? []) as Client[]} wallets={wallets} />
    </div>
  );
}
