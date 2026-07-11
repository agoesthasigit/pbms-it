import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { WalletManager } from "./wallet-manager";
import type { WalletWithBalance } from "@/types/db";

export const metadata = { title: "Wallet" };

export default async function WalletsPage() {
  const supabase = await createClient();

  const { data: balances } = await supabase
    .from("v_wallet_balances")
    .select("*");
  const { data: wallets } = await supabase
    .from("wallets")
    .select("*")
    .order("created_at");

  // Gabungkan data wallet + saldo dari view (BR-01: saldo selalu hasil hitung)
  const merged: WalletWithBalance[] = (wallets ?? []).map((w) => ({
    ...w,
    balance: Number(balances?.find((b) => b.id === w.id)?.balance ?? 0),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wallet"
        description="Semua pemasukan dan pengeluaran terhubung ke wallet. Saldo dihitung otomatis dari transaksi."
      />
      <WalletManager wallets={merged} />
    </div>
  );
}
