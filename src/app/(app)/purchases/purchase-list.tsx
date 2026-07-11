"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ShoppingCart, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type PItem = { qty: number; price: number; product: { name: string } | null };

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
  const [q, setQ] = useState("");

  // ringkas nama barang tiap pembelian
  function itemsOf(p: PurchaseRow): PItem[] {
    return ((p as unknown as { purchase_items?: PItem[] }).purchase_items) ?? [];
  }
  function itemNames(p: PurchaseRow): string {
    const items = itemsOf(p);
    if (items.length === 0) return "-";
    const names = items.map((i) => i.product?.name ?? "?");
    if (names.length <= 2) return names.join(", ");
    return `${names.slice(0, 2).join(", ")} +${names.length - 2} lainnya`;
  }
  function totalQty(p: PurchaseRow): number {
    return itemsOf(p).reduce((s, i) => s + Number(i.qty), 0);
  }

  const filtered = useMemo(() => {
    if (!q) return purchases;
    const key = q.toLowerCase();
    return purchases.filter((p) => {
      const inNames = itemsOf(p).some((i) =>
        (i.product?.name ?? "").toLowerCase().includes(key));
      const inDist = (p.distributor?.name ?? "").toLowerCase().includes(key);
      const inNota = (p.invoice_no ?? "").toLowerCase().includes(key);
      return inNames || inDist || inNota;
    });
  }, [purchases, q]);

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Cari barang, distributor, atau no. nota..."
            value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Pembelian Baru
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState icon={ShoppingCart} title="Belum ada pembelian"
              description="Catat pembelian barang dari distributor. Stok akan bertambah otomatis." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Distributor</TableHead>
                  <TableHead>Barang</TableHead>
                  <TableHead className="text-center">Total Qty</TableHead>
                  <TableHead className="text-right">Total Beli</TableHead>
                  <TableHead className="w-16 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDate(p.purchase_date)}</TableCell>
                    <TableCell className="font-medium">{p.distributor?.name ?? "-"}</TableCell>
                    <TableCell className="max-w-64">
                      <span className="text-sm">{itemNames(p)}</span>
                      {p.invoice_no && (
                        <span className="block text-xs text-muted-foreground">
                          Nota: {p.invoice_no}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">{totalQty(p)}</TableCell>
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
