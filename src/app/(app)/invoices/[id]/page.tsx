import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { formatIDR } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import type { WalletWithBalance } from "@/types/db";
import {
  type MonthlyInvoice, type InvoiceStatus, INVOICE_STATUS_LABELS,
} from "@/types/phase4";
import { InvoiceActions } from "./invoice-actions";

export const metadata = { title: "Detail Invoice" };

const STATUS_STYLE: Record<InvoiceStatus, string> = {
  draft: "bg-slate-100 text-slate-700 hover:bg-slate-100",
  sent: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  paid: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  overdue: "bg-red-100 text-red-700 hover:bg-red-100",
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
    .select("id, sale_date, total, notes, sale_items(qty, price, subtotal, product:products(name))")
    .eq("monthly_invoice_id", id)
    .order("sale_date");

  const { data: balances } = await supabase.from("v_wallet_balances").select("*");
  const { data: rawWallets } = await supabase.from("wallets").select("*").order("created_at");
  const wallets: WalletWithBalance[] = (rawWallets ?? []).map((w) => ({
    ...w,
    balance: Number(balances?.find((b) => b.id === w.id)?.balance ?? 0),
  }));

  const inv = invoice as MonthlyInvoice;
  const st = (inv.effective_status ?? inv.status) as InvoiceStatus;

  return (
    <div className="space-y-6">
      <PageHeader title={inv.invoice_no}
        description={`${inv.company_name} · ${new Date(inv.period_month).toLocaleDateString("id-ID", { month: "long", year: "numeric" })}`}>
        <Button variant="outline" nativeButton={false} render={<Link href="/invoices" />}>
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge className={STATUS_STYLE[st]}>{INVOICE_STATUS_LABELS[st]}</Badge>
        <InvoiceActions invoice={inv} wallets={wallets} />
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

      <Card>
        <CardHeader><CardTitle className="text-base">Rincian Penjualan</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Barang</TableHead>
                <TableHead className="text-center">Qty</TableHead>
                <TableHead className="text-right">Harga</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(sales ?? []).flatMap((s) =>
                (s.sale_items as unknown as {
                  qty: number; price: number; subtotal: number;
                  product: { name: string } | null;
                }[]).map((it, idx) => (
                  <TableRow key={`${s.id}-${idx}`}>
                    <TableCell>{idx === 0 ? formatDate(s.sale_date) : ""}</TableCell>
                    <TableCell>{it.product?.name ?? "-"}</TableCell>
                    <TableCell className="text-center">{it.qty}</TableCell>
                    <TableCell className="text-right">{formatIDR(Number(it.price))}</TableCell>
                    <TableCell className="text-right">{formatIDR(Number(it.subtotal))}</TableCell>
                  </TableRow>
                ))
              )}
              <TableRow className="border-t-2">
                <TableCell colSpan={4} className="text-right font-bold">Grand Total</TableCell>
                <TableCell className="text-right text-lg font-bold">
                  {formatIDR(Number(inv.total))}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
