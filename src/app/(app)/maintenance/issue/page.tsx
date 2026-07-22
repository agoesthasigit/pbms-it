import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { IssueManager } from "./issue-manager";
import type { ChargeRow, MaintenanceContract } from "@/types/maintenance";

export const metadata = { title: "Terbitkan Tagihan Maintenance" };

// periode bawaan = bulan berjalan
function defaultPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default async function IssuePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const sp = await searchParams;
  const period = sp.period && /^\d{4}-\d{2}-01$/.test(sp.period)
    ? sp.period
    : defaultPeriod();

  const supabase = await createClient();

  const [{ data: contracts }, { data: issued }] = await Promise.all([
    supabase
      .from("v_maintenance_contracts")
      .select("*")
      .eq("is_active", true)
      .order("company_name"),
    supabase
      .from("sales")
      .select("id, total, maintenance_contract_id, invoice:monthly_invoices(invoice_no)")
      .eq("maintenance_period", period),
  ]);

  const issuedMap = new Map<string, { id: string; total: number; invoice_no: string | null }>();
  for (const s of (issued ?? []) as unknown as {
    id: string; total: number; maintenance_contract_id: string | null;
    invoice: { invoice_no: string } | null;
  }[]) {
    if (s.maintenance_contract_id) {
      issuedMap.set(s.maintenance_contract_id, {
        id: s.id,
        total: Number(s.total),
        invoice_no: s.invoice?.invoice_no ?? null,
      });
    }
  }

  const rows: ChargeRow[] = ((contracts ?? []) as MaintenanceContract[]).map((c) => {
    const hit = issuedMap.get(c.id);
    return {
      contract_id: c.id,
      company_name: c.company_name ?? "-",
      service_name: c.service_name,
      monthly_amount: Number(c.monthly_amount),
      issued_sale_id: hit?.id ?? null,
      issued_amount: hit?.total ?? null,
      invoice_no: hit?.invoice_no ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Terbitkan Tagihan Maintenance"
          description="Pilih periode, centang kontrak yang mau ditagih, lalu terbitkan. Tagihan otomatis bergabung ke invoice bulanan client."
        />
        <Button variant="outline" nativeButton={false} render={<Link href="/maintenance" />}>
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Button>
      </div>

      <IssueManager period={period} rows={rows} />
    </div>
  );
}
