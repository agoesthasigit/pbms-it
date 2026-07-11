"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ReceiptText, Loader2 } from "lucide-react";
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
import type { ProductWithStock, Client, WalletWithBalance } from "@/types/db";
import { type SaleRow, PAYMENT_METHOD_LABELS } from "@/types/phase3";
import { SaleForm } from "./sale-form";
import { deleteSale } from "./actions";

export function SaleList({
  sales, products, clients, wallets,
}: {
  sales: SaleRow[];
  products: ProductWithStock[];
  clients: Client[];
  wallets: WalletWithBalance[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete(s: SaleRow) {
    if (s.monthly_invoice_id) {
      toast.error("Penjualan sudah masuk invoice bulanan. Lepas dari invoice dulu.");
      return;
    }
    if (!confirm("Hapus penjualan ini? Stok dikembalikan, asset client & transaksi wallet dibatalkan.")) return;
    startTransition(async () => {
      const res = await deleteSale(s.id);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Penjualan dihapus & efeknya dibatalkan.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Penjualan Baru
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {sales.length === 0 ? (
            <EmptyState icon={ReceiptText} title="Belum ada penjualan"
              description="Catat penjualan ke client. Stok turun & asset client dibuat otomatis." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Metode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-16 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{formatDate(s.sale_date)}</TableCell>
                    <TableCell className="font-medium">
                      {s.client?.company_name ?? "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.payment_method === "cash" ? "default" : "secondary"}>
                        {PAYMENT_METHOD_LABELS[s.payment_method]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {s.payment_method === "cash" ? (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Lunas</Badge>
                      ) : s.monthly_invoice_id ? (
                        <Badge variant="outline">Masuk invoice</Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Piutang</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatIDR(Number(s.total))}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(s)} disabled={pending}>
                        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <SaleForm open={open} onOpenChange={setOpen}
        products={products} clients={clients} wallets={wallets} />
    </div>
  );
}
