import { createClient } from "@/lib/supabase/server";
import { getPortalContext } from "@/lib/portal/context";
import { PageHeader } from "@/components/shared/page-header";
import { PortalClient, type Order } from "./portal-client";

export const dynamic = "force-dynamic";

export default async function PortalHomePage() {
  const portal = await getPortalContext();
  const supabase = await createClient();
  const { data } = await supabase.rpc("portal_list_orders", { p_search: null });
  const orders = (Array.isArray(data) ? data : []) as Order[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengajuan Barang"
        description={`Masuk sebagai ${portal?.distributorName ?? "-"}`}
      />
      <PortalClient orders={orders} />
    </div>
  );
}
