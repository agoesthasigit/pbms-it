import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { ContractManager } from "./contract-manager";
import type { Client } from "@/types/db";
import type { MaintenanceContract } from "@/types/maintenance";

export const metadata = { title: "Kontrak Maintenance" };

export default async function MaintenancePage() {
  const supabase = await createClient();

  const [{ data: contracts }, { data: clients }] = await Promise.all([
    supabase
      .from("v_maintenance_contracts")
      .select("*")
      .order("is_active", { ascending: false })
      .order("company_name"),
    supabase
      .from("clients")
      .select("*")
      .eq("status", "active")
      .order("company_name"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kontrak Maintenance"
        description="Biaya maintenance rutin per client. Tagihannya diterbitkan tiap bulan dan otomatis bergabung ke invoice bulanan."
      />
      <ContractManager
        contracts={(contracts ?? []) as MaintenanceContract[]}
        clients={(clients ?? []) as Client[]}
      />
    </div>
  );
}
