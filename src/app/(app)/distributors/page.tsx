import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { DistributorManager } from "./distributor-manager";
import type { Distributor } from "@/types/db";

export const metadata = { title: "Distributor" };

export default async function DistributorsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("distributors")
    .select("*")
    .order("name");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Distributor"
        description="Daftar supplier tempat Anda membeli barang."
      />
      <DistributorManager distributors={(data ?? []) as Distributor[]} />
    </div>
  );
}
