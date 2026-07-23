"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Eye, Trash2, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatIDR } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { EmptyState } from "@/components/shared/empty-state";
import {
  type MonthlyInvoice, type InvoiceStatus, INVOICE_STATUS_LABELS,
} from "@/types/phase4";
import { deleteInvoice } from "./actions";

const STATUS_STYLE: Record<InvoiceStatus, string> = {
  draft: "bg-slate-100 text-slate-700 hover:bg-slate-100",
  sent: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  paid: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  overdue: "bg-red-100 text-red-700 hover:bg-red-100",
};

export function InvoiceList({ invoices }: { invoices: MonthlyInvoice[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!q) return invoices;
    const key = q.toLowerCase();
    return invoices.filter((inv) =>
      `${inv.invoice_no} ${inv.company_name ?? ""}`.toLowerCase().includes(key));
  }, [invoices, q]);

  function handleDelete(inv: MonthlyInvoice) {
    if (!confirm(
      `Hapus/batalkan ${inv.invoice_no}? Penjualan di dalamnya kembali menjadi piutang${
        inv.effective_status === "paid" ? " dan pemasukan wallet dibatalkan" : ""
      }.`
    )) return;
    startTransition(async () => {
      const res = await deleteInvoice(inv.id);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Invoice dibatalkan.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Cari no. invoice atau client..."
          value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState icon={FileText} title="Belum ada invoice"
              description="Invoice terbentuk otomatis saat Anda menyimpan penjualan metode Invoice Bulanan." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. Invoice</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Periode</TableHead>
                  <TableHead>Jatuh Tempo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-24 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((inv) => {
                  const st = (inv.effective_status ?? inv.status) as InvoiceStatus;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.invoice_no}</TableCell>
                      <TableCell>{inv.company_name ?? "-"}</TableCell>
                      <TableCell>
                        {new Date(inv.period_month).toLocaleDateString("id-ID", {
                          month: "long", year: "numeric",
                        })}
                      </TableCell>
                      <TableCell>{inv.due_date ? formatDate(inv.due_date) : "-"}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_STYLE[st]}>{INVOICE_STATUS_LABELS[st]}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatIDR(Number(inv.total))}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" nativeButton={false}
                          render={<Link href={`/invoices/${inv.id}`} />}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(inv)} disabled={pending}>
                          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
