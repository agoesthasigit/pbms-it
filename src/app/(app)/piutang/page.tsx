import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import {
  PiutangClient, type PiutangInvoice, type PiutangSale,
} from "./piutang-client";

export const metadata = { title: "Piutang" };

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function PiutangPage() {
  const supabase = await createClient();

  const [invRes, saleRes] = await Promise.all([
    // Invoice bulanan belum lunas
    supabase.from("v_monthly_invoices")
      .select("id, invoice_no, company_name, total, due_date, period_month, effective_status")
      .neq("status", "paid")
      .order("due_date", { ascending: true }),
    // Penjualan terhutang belum lunas (paid_date masih null)
    supabase.from("sales")
      .select("id, sale_date, due_date, total, client:clients(company_name)")
      .eq("payment_method", "terhutang")
      .is("paid_date", null)
      .order("due_date", { ascending: true }),
  ]);

  const invoices = (invRes.data ?? []) as PiutangInvoice[];
  const sales: PiutangSale[] = ((saleRes.data ?? []) as any[]).map((s) => ({
    id: s.id,
    company_name: s.client?.company_name ?? "-",
    sale_date: s.sale_date,
    due_date: s.due_date,
    total: Number(s.total),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Piutang"
        description="Uang yang belum diterima dari client — invoice bulanan belum lunas + penjualan terhutang."
      />
      <PiutangClient invoices={invoices} sales={sales} />
    </div>
  );
}
