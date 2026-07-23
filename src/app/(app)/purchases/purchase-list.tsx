"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ShoppingCart, Loader2, Search, RotateCcw, Receipt, Boxes } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatIDR } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { EmptyState } from "@/components/shared/empty-state";
import { SummaryCard } from "@/components/shared/summary-card";
import { StatCard } from "@/components/shared/stat-card";
import { usePagination } from "@/components/shared/use-pagination";
import { PaginationBar } from "@/components/shared/pagination-bar";
import type { ProductWithStock, Distributor, WalletWithBalance } from "@/types/db";
import type { PurchaseRow } from "@/types/phase3";
import { PurchaseForm } from "./purchase-form";
import { deletePurchase } from "./actions";

type PItem = { qty: number; price: number; product: { name: string } | null };

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function monthRange() {
  const now = new Date();
  return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)),
           to: fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
}
function lastMonthRange() {
  const now = new Date();
  return { from: fmt(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
           to: fmt(new Date(now.getFullYear(), now.getMonth(), 0)) };
}

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

  const def = monthRange();
  const [from, setFrom] = useState(def.from);
  const [to, setTo] = useState(def.to);

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
    const key = q.toLowerCase();
    return purchases.filter((p) => {
      if (from && p.purchase_date < from) return false;
      if (to && p.purchase_date > to) return false;
      if (key) {
        const inNames = itemsOf(p).some((i) =>
          (i.product?.name ?? "").toLowerCase().includes(key));
        const inDist = (p.distributor?.name ?? "").toLowerCase().includes(key);
        const inNota = (p.invoice_no ?? "").toLowerCase().includes(key);
        if (!inNames && !inDist && !inNota) return false;
      }
      return true;
    });
  }, [purchases, q, from, to]);

  const pg = usePagination(filtered, 10, `${q}|${from}|${to}`);

  // total mengikuti rentang tanggal terpilih (default: bulan berjalan)
  const totalPeriod = filtered.reduce((s, p) => s + Number(p.total), 0);

  // Ringkasan turunan untuk kartu pendamping — murni tampilan, dihitung dari
  // `filtered` yang sudah ada. Tidak ada query atau perhitungan baru.
  const notaCount = filtered.length;
  const unitCount = filtered.reduce((s, p) => s + totalQty(p), 0);
  const avgPerNota = notaCount > 0 ? totalPeriod / notaCount : 0;

  // pembanding %: bandingkan rentang terpilih dengan periode SEBELUMNYA yang setara.
  // Default (bulan ini) → dibanding bulan lalu. Jika difilter custom → dibanding total bulan lalu penuh.
  const isThisMonth = from === def.from && to === def.to;
  const { compareTotal, percent, compareLabel } = useMemo(() => {
    const lm = lastMonthRange();
    const sumRange = (a: string, b: string) =>
      purchases.filter((p) => p.purchase_date >= a && p.purchase_date <= b)
        .reduce((s, p) => s + Number(p.total), 0);
    const lastM = sumRange(lm.from, lm.to);
    const pct = lastM > 0 ? ((totalPeriod - lastM) / lastM) * 100 : (totalPeriod > 0 ? 100 : null);
    return {
      compareTotal: lastM,
      percent: pct,
      compareLabel: isThisMonth ? "Dari bulan lalu" : "Dibanding bulan lalu",
    };
  }, [purchases, totalPeriod, isThisMonth]);

  function resetRange() { setFrom(def.from); setTo(def.to); setQ(""); }

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
      {/* Baris ringkasan — semuanya ikut filter tanggal */}
      <div className="grid gap-4 lg:grid-cols-3">
        <SummaryCard
          title={isThisMonth ? "Total Pembelian Bulan Ini" : "Total Pembelian (Periode Dipilih)"}
          value={totalPeriod}
          icon={ShoppingCart}
          compareLabel={compareLabel}
          compareValue={compareTotal}
          percent={percent}
          invertColor
        />
        <StatCard
          label="Jumlah Nota"
          value={String(notaCount)}
          icon={Receipt}
          hint={`${unitCount} unit barang masuk`}
        />
        <StatCard
          label="Rata-rata per Nota"
          value={formatIDR(avgPerNota)}
          icon={Boxes}
          hint={notaCount > 0 ? "Total dibagi jumlah nota" : "Belum ada nota"}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:max-w-2xl lg:grid-cols-3">
          <div className="space-y-1 sm:col-span-2 lg:col-span-1">
            <Label className="text-xs">Cari</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Barang / distributor / nota..."
                value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Dari Tanggal</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Sampai Tanggal</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetRange} title="Kembali ke bulan ini">
            <RotateCcw className="h-4 w-4" /> Bulan Ini
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Pembelian Baru
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState icon={ShoppingCart} title="Tidak ada pembelian"
              description="Tidak ada pembelian pada rentang tanggal ini. Ubah filter atau catat pembelian baru." />
          ) : (
            <>
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
                {pg.paged.map((p) => (
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
            <PaginationBar page={pg.page} totalPages={pg.totalPages}
              from={pg.from} to={pg.to} total={pg.total}
              onPageChange={pg.setPage} unit="nota" />
            </>
          )}
        </CardContent>
      </Card>

      <PurchaseForm open={open} onOpenChange={setOpen}
        products={products} distributors={distributors} wallets={wallets} />
    </div>
  );
}
