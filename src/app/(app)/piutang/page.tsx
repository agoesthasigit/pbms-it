import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatIDR } from "@/lib/utils/currency";
import {
  PiutangClient, type PiutangInvoice, type PiutangSale,
} from "./piutang-client";
import { HutangClient, type HutangPurchase } from "./hutang-client";

export const metadata = { title: "Piutang & Hutang" };

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function PiutangPage() {
  const supabase = await createClient();

  const [invRes, saleRes, hutRes, walRes] = await Promise.all([
    // PIUTANG — invoice bulanan belum lunas
    supabase.from("v_monthly_invoices")
      .select("id, invoice_no, company_name, total, due_date, period_month, effective_status")
      .neq("status", "paid")
      .order("due_date", { ascending: true }),
    // PIUTANG — penjualan terhutang belum lunas
    supabase.from("sales")
      .select("id, sale_date, due_date, total, client:clients(company_name)")
      .eq("payment_method", "terhutang")
      .is("paid_date", null)
      .order("due_date", { ascending: true }),
    // HUTANG — pembelian hutang belum lunas
    supabase.from("purchases")
      .select("id, purchase_date, due_date, total, invoice_no, distributor:distributors(name)")
      .eq("is_credit", true)
      .is("paid_date", null)
      .order("due_date", { ascending: true }),
    // Wallet untuk dialog bayar hutang
    supabase.from("v_wallet_balances").select("id, name, balance, is_active"),
  ]);

  const invoices = (invRes.data ?? []) as PiutangInvoice[];
  const sales: PiutangSale[] = ((saleRes.data ?? []) as any[]).map((s) => ({
    id: s.id,
    company_name: s.client?.company_name ?? "-",
    sale_date: s.sale_date,
    due_date: s.due_date,
    total: Number(s.total),
  }));
  const hutangs: HutangPurchase[] = ((hutRes.data ?? []) as any[]).map((p) => ({
    id: p.id,
    distributor_name: p.distributor?.name ?? "-",
    purchase_date: p.purchase_date,
    due_date: p.due_date,
    total: Number(p.total),
    invoice_no: p.invoice_no,
  }));
  const walletItems = ((walRes.data ?? []) as any[])
    .filter((w) => w.is_active)
    .map((w) => ({ value: w.id, label: `${w.name} · ${formatIDR(Number(w.balance))}` }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Piutang & Hutang"
        description="Piutang = uang belum diterima dari client. Hutang = uang belum dibayar ke distributor."
      />
      <Tabs defaultValue="piutang">
        <TabsList>
          <TabsTrigger value="piutang">Piutang</TabsTrigger>
          <TabsTrigger value="hutang">Hutang</TabsTrigger>
        </TabsList>
        <TabsContent value="piutang" className="pt-4">
          <PiutangClient invoices={invoices} sales={sales} />
        </TabsContent>
        <TabsContent value="hutang" className="pt-4">
          <HutangClient hutangs={hutangs} walletItems={walletItems} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
