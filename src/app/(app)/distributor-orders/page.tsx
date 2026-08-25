import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { OrdersClient, type AdminOrder, type ProductFlag } from "./orders-client";
import type { WalletWithBalance } from "@/types/db";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  order_date: string;
  destination: string | null;
  status: "draft" | "accepted" | "rejected";
  created_at: string;
  purchase_id: string | null;
  distributor: { name: string } | null;
  items: { id: string; name: string; qty: number; cost_price: number }[] | null;
  purchase: { paid_date: string | null } | null;
};

export default async function DistributorOrdersPage() {
  const supabase = await createClient();
  const [ordRes, cliRes, balRes, walRes, prodRes] = await Promise.all([
    supabase
      .from("distributor_orders")
      .select(
        "id, order_date, destination, status, created_at, purchase_id, " +
          "distributor:distributors!distributor_id(name), " +
          "items:distributor_order_items(id,name,qty,cost_price), " +
          "purchase:purchases!purchase_id(paid_date)"
      )
      .in("status", ["draft", "accepted"])
      .order("order_date", { ascending: false }),
    supabase.from("clients").select("id, company_name").eq("status", "active").order("company_name"),
    supabase.from("v_wallet_balances").select("*"),
    supabase.from("wallets").select("*").order("created_at"),
    supabase.from("v_product_stock").select("name, track_as_asset, is_active"),
  ]);

  const orders: AdminOrder[] = ((ordRes.data as Row[] | null) ?? []).map((r) => ({
    id: r.id,
    order_date: r.order_date,
    destination: r.destination,
    status: r.status,
    distributor_name: r.distributor?.name ?? "-",
    is_paid: !!r.purchase?.paid_date,
    items: (r.items ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
  }));

  const clients = ((cliRes.data as { id: string; company_name: string }[] | null) ?? []).map((c) => ({
    id: c.id,
    company_name: c.company_name,
  }));

  const balances = (balRes.data as { id: string; balance: number | string }[] | null) ?? [];
  const wallets: WalletWithBalance[] = ((walRes.data as WalletWithBalance[] | null) ?? []).map((w) => ({
    ...w,
    balance: Number(balances.find((b) => b.id === w.id)?.balance ?? 0),
  }));

  // Peta setelan katalog per nama produk (lower-case) untuk pra-isi toggle.
  const productFlags: Record<string, ProductFlag> = {};
  for (const p of (prodRes.data as { name: string; track_as_asset: boolean; is_active: boolean }[] | null) ?? []) {
    productFlags[p.name.toLowerCase()] = {
      track_as_asset: p.track_as_asset,
      is_active: p.is_active,
    };
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengajuan Masuk"
        description="Pengajuan barang dari distributor. Terima untuk masuk stok & hutang."
      />
      <OrdersClient
        orders={orders}
        clients={clients}
        wallets={wallets}
        productFlags={productFlags}
      />
    </div>
  );
}
