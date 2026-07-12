"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ReceiptText, Loader2, Search, RotateCcw, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatIDR } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { EmptyState } from "@/components/shared/empty-state";
import { SummaryCard } from "@/components/shared/summary-card";
import type { ProductWithStock, Client, WalletWithBalance } from "@/types/db";
import { type SaleRow, PAYMENT_METHOD_LABELS } from "@/types/phase3";
import { SaleForm } from "./sale-form";
import { deleteSale } from "./actions";

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

  const [q, setQ] = useState("");
  const def = monthRange();
  const [from, setFrom] = useState(def.from);
  const [to, setTo] = useState(def.to);

  const filtered = useMemo(() => {
    const key = q.toLowerCase();
    return sales.filter((s) => {
      if (from && s.sale_date < from) return false;
      if (to && s.sale_date > to) return false;
      if (key) {
        const inClient = (s.client?.company_name ?? "").toLowerCase().includes(key);
        const inMethod = PAYMENT_METHOD_LABELS[s.payment_method].toLowerCase().includes(key);
        if (!inClient && !inMethod) return false;
      }
      return true;
    });
  }, [sales, q, from, to]);

  // total mengikuti rentang tanggal terpilih (default: bulan berjalan)
  const totalPeriod = filtered.reduce((s, x) => s + Number(x.total), 0);

  const isThisMonth = from === def.from && to === def.to;
  const { compareTotal, percent, compareLabel } = useMemo(() => {
    const lm = lastMonthRange();
    const sumRange = (a: string, b: string) =>
      sales.filter((s) => s.sale_date >= a && s.sale_date <= b)
        .reduce((acc, s) => acc + Number(s.total), 0);
    const lastM = sumRange(lm.from, lm.to);
    const pct = lastM > 0 ? ((totalPeriod - lastM) / lastM) * 100 : (totalPeriod > 0 ? 100 : null);
    return {
      compareTotal: lastM,
      percent: pct,
      compareLabel: isThisMonth ? "Dari bulan lalu" : "Dibanding bulan lalu",
    };
  }, [sales, totalPeriod, isThisMonth]);

  function resetRange() { setFrom(def.from); setTo(def.to); setQ(""); }

  function handleDelete(s: SaleRow) {
    if (!confirm("Hapus penjualan ini? Stok dikembalikan, asset & transaksi terkait dibatalkan.")) return;
    startTransition(async () => {
      const res = await deleteSale(s.id);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Penjualan dihapus & efeknya dibatalkan.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* 1 kartu total — ikut filter tanggal */}
      <div className="grid gap-4 sm:max-w-md">
        <SummaryCard
          title={isThisMonth ? "Total Penjualan Bulan Ini" : "Total Penjualan (Periode Dipilih)"}
          value={totalPeriod}
          icon={TrendingUp}
          compareLabel={compareLabel}
          compareValue={compareTotal}
          percent={percent}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:max-w-2xl lg:grid-cols-3">
          <div className="space-y-1 sm:col-span-2 lg:col-span-1">
            <Label className="text-xs">Cari</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Client / metode..."
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
            <Plus className="h-4 w-4" /> Penjualan Baru
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState icon={ReceiptText} title="Tidak ada penjualan"
              description="Tidak ada penjualan pada rentang tanggal ini. Ubah filter atau catat penjualan baru." />
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
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{formatDate(s.sale_date)}</TableCell>
                    <TableCell className="font-medium">{s.client?.company_name ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant={s.payment_method === "cash" ? "default" : "secondary"}>
                        {PAYMENT_METHOD_LABELS[s.payment_method]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {s.payment_method === "cash" ? (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Lunas</Badge>
                      ) : (
                        <Badge variant="outline">Masuk invoice</Badge>
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
