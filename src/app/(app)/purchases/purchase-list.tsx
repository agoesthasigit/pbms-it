"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ShoppingCart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatIDR } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { EmptyState } from "@/components/shared/empty-state";
import type { ProductWithStock, Distributor, WalletWithBalance } from "@/types/db";
import type { PurchaseRow } from "@/types/phase3";
import { PurchaseForm } from "./purchase-form";
import { deletePurchase } from "./actions";

export function PurchaseList({
  purchases, products, distributors, wallets,
}: {
  purchases: PurchaseRow[];
  products: ProductWithStock[];
  distributors: Distributor[];
  wallets: WalletWithBalance[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete(p: PurchaseRow) {
    if (!confirm("Hapus pembelian ini? Stok akan dikembalikan dan saldo wallet dikoreksi.")) return;
    startTransition(async () => {
      const res = await deletePurchase(p.id);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Pembelian dihapus & efeknya dibatalkan.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Pembelian Baru
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {purchases.length === 0 ? (
            <EmptyState icon={ShoppingCart} title="Belum ada pembelian"
              description="Catat pembelian barang dari distributor. Stok akan bertambah otomatis." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Distributor</TableHead>
                  <TableHead>No. Nota</TableHead>
                  <TableHead>Wallet</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-16 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDate(p.purchase_date)}</TableCell>
                    <TableCell className="font-medium">
                      {p.distributor?.name ?? "-"}
                    </TableCell>
                    <TableCell>{p.invoice_no ?? "-"}</TableCell>
                    <TableCell>{p.wallet?.name ?? "-"}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatIDR(Number(p.total))}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(p)} disabled={pending}>
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

      <PurchaseForm open={open} onOpenChange={setOpen}
        products={products} distributors={distributors} wallets={wallets} />
    </div>
  );
}
