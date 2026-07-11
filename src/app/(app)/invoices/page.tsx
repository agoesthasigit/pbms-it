import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { InvoiceList } from "./invoice-list";
import type { MonthlyInvoice } from "@/types/phase4";

export const metadata = { title: "Invoice Bulanan" };

export default async function InvoicesPage() {
  const supabase = await createClient();

  const { data: invoices } = await supabase
    .from("v_monthly_invoices").select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoice Bulanan"
        description="Invoice terbentuk otomatis dari penjualan piutang. Penjualan dengan client + periode + jatuh tempo sama otomatis tergabung."
      />
      <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
        Invoice dibuat otomatis saat Anda menyimpan penjualan dengan metode
        <b> Invoice Bulanan</b>. Di sini Anda menandai terkirim/lunas dan mengunduh PDF.
      </div>
      <InvoiceList invoices={(invoices ?? []) as MonthlyInvoice[]} />
    </div>
  );
}
