import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { formatIDR } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { SOFT_TONES } from "@/lib/utils/soft-tone";
import type { WalletWithBalance } from "@/types/db";
import {
  type MonthlyInvoice, type InvoiceStatus, INVOICE_STATUS_LABELS,
  BRAND_LABELS, BRAND_TONE, toBrand,
} from "@/types/phase4";
import { InvoiceActions } from "./invoice-actions";
import { InvoiceLines } from "./invoice-lines";

export const metadata = { title: "Detail Invoice" };

const STATUS_STYLE: Record<InvoiceStatus, string> = {
  draft: SOFT_TONES.slate,
  sent: SOFT_TONES.sky,
  paid: SOFT_TONES.emerald,
  overdue: SOFT_TONES.red,
};

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("v_monthly_invoices").select("*").eq("id", id).single();
  if (!invoice) notFound();

  // penjualan yang tergabung + itemnya
  const { data: sales } = await supabase
    .from("sales")
    .select("id, sale_date, total, notes, maintenance_contract_id, sale_items(id, qty, price, subtotal, item_name, product:products(name, is_service))")
    .eq("monthly_invoice_id", id)
    .order("sale_date");

  // Nilai JASA di invoice ini → usulan dasar kena pajak PPh 23 saat pelunasan
  const { data: serviceBase } = await supabase
    .rpc("invoice_service_base", { p_invoice_id: id });

  // Daftar barang (bukan jasa) untuk dialog "Tambah Baris"
  const { data: rawProducts } = await supabase
    .from("v_product_stock")
    .select("id, name, current_stock, default_selling_price, default_warranty_months")
    .eq("is_service", false)
    .eq("is_active", true)
    .order("name");
  const productOptions = (rawProducts ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    current_stock: Number(p.current_stock ?? 0),
    default_selling_price: Number(p.default_selling_price ?? 0),
    default_warranty_months: Number(p.default_warranty_months ?? 12),
  }));

  const { data: balances } = await supabase.from("v_wallet_balances").select("*");
  const { data: rawWallets } = await supabase.from("wallets").select("*").order("created_at");
  const wallets: WalletWithBalance[] = (rawWallets ?? []).map((w) => ({
    ...w,
    balance: Number(balances?.find((b) => b.id === w.id)?.balance ?? 0),
  }));

  // Baris maintenance selalu tampil PALING ATAS (sama seperti di PDF),
  // baru penjualan barang menurut tanggal.
  const ordered = [...(sales ?? [])].sort((a, b) => {
    const am = (a as { maintenance_contract_id: string | null }).maintenance_contract_id ? 0 : 1;
    const bm = (b as { maintenance_contract_id: string | null }).maintenance_contract_id ? 0 : 1;
    if (am !== bm) return am - bm;
    return String(a.sale_date).localeCompare(String(b.sale_date));
  });

  const inv = invoice as MonthlyInvoice;
  const st = (inv.effective_status ?? inv.status) as InvoiceStatus;

  // Baris rata (flatten) untuk tabel rincian — dipakai komponen interaktif.
  const rows = ordered.flatMap((s) => {
    const isMaint = Boolean(
      (s as { maintenance_contract_id: string | null }).maintenance_contract_id
    );
    const items = s.sale_items as unknown as {
      id: string; qty: number; price: number; subtotal: number;
      item_name: string | null;
      product: { name: string; is_service: boolean } | null;
    }[];
    return items.map((it, idx) => ({
      saleItemId: it.id,
      dateLabel: idx === 0 ? formatDate(s.sale_date) : "",
      name: it.item_name ?? it.product?.name ?? "-",
      isService: Boolean(it.product?.is_service),
      isMaintenance: isMaint,
      qty: it.qty,
      price: Number(it.price),
      subtotal: Number(it.subtotal),
    }));
  });

  return (
    <div className="space-y-6">
      <PageHeader title={inv.invoice_no}
        description={`${inv.company_name} · ${new Date(inv.period_month).toLocaleDateString("id-ID", { month: "long", year: "numeric" })}`}>
        <Button variant="outline" nativeButton={false} render={<Link href="/invoices" />}>
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge className={STATUS_STYLE[st]}>{INVOICE_STATUS_LABELS[st]}</Badge>
          <Badge className={SOFT_TONES[BRAND_TONE[toBrand(inv.brand)]]}>
            {BRAND_LABELS[toBrand(inv.brand)]}
          </Badge>
        </div>
        <InvoiceActions invoice={inv} wallets={wallets}
          serviceBase={Number(serviceBase ?? 0)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">Total Tagihan</p>
            <p className="mt-1 text-2xl font-bold">{formatIDR(Number(inv.total))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">Jatuh Tempo</p>
            <p className="mt-1 text-lg font-semibold">
              {inv.due_date ? formatDate(inv.due_date) : "-"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">Tanggal Bayar</p>
            <p className="mt-1 text-lg font-semibold">
              {inv.paid_date ? formatDate(inv.paid_date) : "Belum dibayar"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* PPh 23: invoice ditagih penuh, client memotong pajak atas jasa */}
      {Number(inv.pph_amount ?? 0) > 0 && (
        <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-500/25 dark:bg-amber-500/10">
          <CardHeader>
            <CardTitle className="text-base">Potongan PPh 23 (Pajak Jasa)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ditagihkan ke client (bruto)</span>
              <span className="font-medium">{formatIDR(Number(inv.total))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Dasar kena pajak (jasa) × {Number(inv.pph_rate ?? 2.5)}%
              </span>
              <span className="font-medium">{formatIDR(Number(inv.pph_base ?? 0))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">PPh 23 dipotong client</span>
              <span className="font-medium text-destructive">
                − {formatIDR(Number(inv.pph_amount ?? 0))}
              </span>
            </div>
            <div className="flex justify-between border-t border-amber-200 pt-1.5 font-semibold dark:border-amber-500/25">
              <span>Uang diterima (netto)</span>
              <span className="text-emerald-600 dark:text-emerald-400">
                {formatIDR(Number(inv.total) - Number(inv.pph_amount ?? 0))}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <InvoiceLines
        invoiceId={inv.id}
        status={inv.status}
        total={Number(inv.total)}
        rows={rows}
        products={productOptions}
      />
    </div>
  );
}
