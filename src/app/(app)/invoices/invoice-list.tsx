"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Eye, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

  if (invoices.length === 0) {
    return (
      <Card>
        <CardContent>
          <EmptyState icon={FileText} title="Belum ada invoice"
            description="Buat invoice dari penjualan piutang client lewat tombol Buat Invoice." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
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
            {invoices.map((inv) => {
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
                    <Badge className={STATUS_STYLE[st]}>
                      {INVOICE_STATUS_LABELS[st]}
                    </Badge>
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
      </CardContent>
    </Card>
  );
}
