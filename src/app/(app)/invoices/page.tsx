import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { GenerateDialog } from "./generate-dialog";
import { InvoiceList } from "./invoice-list";
import type { Client } from "@/types/db";
import type { MonthlyInvoice } from "@/types/phase4";

export const metadata = { title: "Invoice Bulanan" };

export default async function InvoicesPage() {
  const supabase = await createClient();

  const [{ data: invoices }, { data: clients }, { data: receivableSales }] =
    await Promise.all([
      supabase.from("v_monthly_invoices").select("*")
        .order("created_at", { ascending: false }),
      supabase.from("clients").select("*").eq("status", "active").order("company_name"),
      supabase.from("sales")
        .select("client_id, total, client:clients(company_name)")
        .eq("payment_method", "monthly_invoice")
        .is("monthly_invoice_id", null),
    ]);

  // rekap piutang per client (untuk dropdown generate)
  const map = new Map<string, { client_id: string; company_name: string; total: number; count: number }>();
  for (const s of receivableSales ?? []) {
    const key = s.client_id;
    const prev = map.get(key);
    const company =
      (s.client as unknown as { company_name?: string })?.company_name ?? "-";
    if (prev) {
      prev.total += Number(s.total);
      prev.count += 1;
    } else {
      map.set(key, {
        client_id: key, company_name: company,
        total: Number(s.total), count: 1,
      });
    }
  }
  const receivables = Array.from(map.values());
  const totalReceivable = receivables.reduce((s, r) => s + r.total, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoice Bulanan"
        description="Kumpulkan penjualan piutang menjadi tagihan bulanan per client, lalu tandai lunas & cetak PDF."
      >
        <GenerateDialog
          clients={(clients ?? []) as Client[]}
          receivables={receivables}
        />
      </PageHeader>

      {totalReceivable > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Ada piutang belum ditagih dari {receivables.length} client. Total:{" "}
          <b>{new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(totalReceivable)}</b>.
          Klik "Buat Invoice" untuk menagih.
        </div>
      )}

      <InvoiceList invoices={(invoices ?? []) as MonthlyInvoice[]} />
    </div>
  );
}
