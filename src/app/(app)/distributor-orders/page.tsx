import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { OrdersClient, type AdminOrder } from "./orders-client";

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
  const { data } = await supabase
    .from("distributor_orders")
    .select(
      "id, order_date, destination, status, created_at, purchase_id, " +
        "distributor:distributors!distributor_id(name), " +
        "items:distributor_order_items(id,name,qty,cost_price), " +
        "purchase:purchases!purchase_id(paid_date)"
    )
    .in("status", ["draft", "accepted"])
    .order("order_date", { ascending: false });

  const orders: AdminOrder[] = ((data as Row[] | null) ?? []).map((r) => ({
    id: r.id,
    order_date: r.order_date,
    destination: r.destination,
    status: r.status,
    distributor_name: r.distributor?.name ?? "-",
    is_paid: !!r.purchase?.paid_date,
    items: (r.items ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengajuan Masuk"
        description="Pengajuan barang dari distributor. Terima untuk masuk stok & hutang."
      />
      <OrdersClient orders={orders} />
    </div>
  );
}
