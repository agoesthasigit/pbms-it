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
import { usePagination } from "@/components/shared/use-pagination";
import { PaginationBar } from "@/components/shared/pagination-bar";
import {
  type MonthlyInvoice, type InvoiceStatus, INVOICE_STATUS_LABELS,
  BRAND_LABELS, BRAND_TONE, toBrand,
} from "@/types/phase4";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { deleteInvoice } from "./actions";
import { SOFT_TONES } from "@/lib/utils/soft-tone";

const STATUS_STYLE: Record<InvoiceStatus, string> = {
  draft: SOFT_TONES.red,
  sent: SOFT_TONES.sky,
  paid: SOFT_TONES.emerald,
  overdue: SOFT_TONES.red,
};

export function InvoiceList({ invoices }: { invoices: MonthlyInvoice[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!q) return invoices;
    const key = q.toLowerCase();
    return invoices.filter((inv) =>
      `${inv.invoice_no} ${inv.company_name ?? ""} ${BRAND_LABELS[toBrand(inv.brand)]}`
        .toLowerCase().includes(key));
  }, [invoices, q]);

  const pg = usePagination(filtered, 10, q);

  async function handleDelete(inv: MonthlyInvoice) {
    if (!(await confirm({
      title: `Hapus/batalkan ${inv.invoice_no}?`,
      description:
        `Penjualan di dalamnya kembali menjadi piutang${
          inv.effective_status === "paid" ? " dan pemasukan wallet dibatalkan" : ""
        }.`,
      destructive: true, confirmText: "Hapus",
    }))) return;
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
            <>
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
                {pg.paged.map((inv) => {
                  const st = (inv.effective_status ?? inv.status) as InvoiceStatus;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col gap-1">
                          <span>{inv.invoice_no}</span>
                          <Badge className={`w-fit ${SOFT_TONES[BRAND_TONE[toBrand(inv.brand)]]}`}>
                            {BRAND_LABELS[toBrand(inv.brand)]}
                          </Badge>
                        </div>
                      </TableCell>
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
                          title="Lihat invoice"
                          render={<Link href={`/invoices/${inv.id}`} />}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          title="Hapus" onClick={() => handleDelete(inv)} disabled={pending}>
                          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <PaginationBar page={pg.page} totalPages={pg.totalPages}
              from={pg.from} to={pg.to} total={pg.total}
              onPageChange={pg.setPage} unit="invoice" />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
