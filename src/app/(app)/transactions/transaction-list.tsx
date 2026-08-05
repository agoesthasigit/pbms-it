"use client";

import { useMemo, useState } from "react";
import {
  Search, RotateCcw, ArrowLeftRight, TrendingUp, TrendingDown, Scale,
  ArrowDownCircle, ArrowUpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatIDR } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";
import { SOFT_TONES } from "@/lib/utils/soft-tone";
import { usePagination } from "@/components/shared/use-pagination";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { ReportDownload } from "@/components/shared/report-download";
import { type TxRow, TX_SOURCE_LABEL } from "@/types/reports";

// Tipe & label baris dipindah ke types/reports.ts agar dipakai bersama
// dengan route export (isi layar & file unduhan harus identik).
export type { TxRow };

type Opt = { value: string; label: string };

const SOURCE_LABEL = TX_SOURCE_LABEL;

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
// Rentang default = bulan berjalan penuh: tanggal 1 s/d akhir bulan.
function thisMonthRange() {
  const now = new Date();
  return {
    from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

export function TransactionList({
  rows, wallets, categories, labels,
}: {
  rows: TxRow[];
  wallets: Opt[];
  categories: Opt[];
  labels: Opt[];
}) {
  const def = thisMonthRange();
  const [from, setFrom] = useState(def.from);
  const [to, setTo] = useState(def.to);
  const [dir, setDir] = useState("all");
  const [walletId, setWalletId] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [labelId, setLabelId] = useState("all");
  const [q, setQ] = useState("");

  const dirItems: Opt[] = [
    { value: "all", label: "Semua arah" },
    { value: "in", label: "Pemasukan" },
    { value: "out", label: "Pengeluaran" },
  ];
  const walletItems: Opt[] = [{ value: "all", label: "Semua wallet" }, ...wallets];
  const categoryItems: Opt[] = [{ value: "all", label: "Semua kategori" }, ...categories];
  const labelItems: Opt[] = [{ value: "all", label: "Semua label" }, ...labels];

  const filtered = useMemo(() => {
    const key = q.toLowerCase();
    return rows.filter((r) => {
      if (from && r.date < from) return false;
      if (to && r.date > to) return false;
      if (dir !== "all" && r.direction !== dir) return false;
      if (walletId !== "all" && r.walletId !== walletId) return false;
      if (categoryId !== "all" && r.categoryId !== categoryId) return false;
      if (labelId !== "all" && r.labelId !== labelId) return false;
      if (key) {
        const hay = [r.party, r.description, r.walletName, SOURCE_LABEL[r.source]]
          .join(" ").toLowerCase();
        if (!hay.includes(key)) return false;
      }
      return true;
    });
  }, [rows, from, to, dir, walletId, categoryId, labelId, q]);

  // Baris ber-countInTotal=false (penjualan via invoice) tetap tampil di daftar
  // tapi tidak dijumlahkan — uangnya dihitung lewat baris pelunasan invoice.
  const counted = filtered.filter((r) => r.countInTotal !== false);
  const inRows = counted.filter((r) => r.direction === "in");
  const outRows = counted.filter((r) => r.direction === "out");
  const totalIn = inRows.reduce((s, r) => s + r.amount, 0);
  const totalOut = outRows.reduce((s, r) => s + r.amount, 0);
  const net = totalIn - totalOut;

  const pg = usePagination(filtered, 15,
    `${dir}|${walletId}|${categoryId}|${labelId}|${from}|${to}|${q}`);

  function resetAll() {
    setFrom(def.from); setTo(def.to); setDir("all");
    setWalletId("all"); setCategoryId("all"); setLabelId("all"); setQ("");
  }

  const filterActive = categoryId !== "all" || labelId !== "all";

  return (
    <div className="space-y-4">
      {/* Unduhan mengikuti rentang tanggal yang sedang dipilih */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Menampilkan {filtered.length} transaksi ({from} s/d {to})
        </p>
        <ReportDownload href="/api/reports/transactions" from={from} to={to}
          label="Unduh Riwayat" />
      </div>

      {/* Ringkasan mengikuti filter */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Pemasukan" value={formatIDR(totalIn)} icon={TrendingUp}
          tone="emerald" accent="text-emerald-600" hint={`${inRows.length} transaksi`} />
        <StatCard label="Total Pengeluaran" value={formatIDR(totalOut)} icon={TrendingDown}
          tone="red" accent="text-destructive" hint={`${outRows.length} transaksi`} />
        <StatCard label="Selisih (Net)" value={formatIDR(net)} icon={Scale}
          tone={net >= 0 ? "emerald" : "red"}
          accent={net >= 0 ? "text-emerald-600" : "text-destructive"}
          hint="Pemasukan − Pengeluaran" />
      </div>

      {/* Filter */}
      <div className="space-y-2">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">Cari</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Pihak / keterangan..."
                value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Arah</Label>
            <Select items={dirItems} value={dir} onValueChange={(v) => setDir(v ?? "all")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {dirItems.map((it) => <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Wallet</Label>
            <Select items={walletItems} value={walletId} onValueChange={(v) => setWalletId(v ?? "all")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {walletItems.map((it) => <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Kategori</Label>
            <Select items={categoryItems} value={categoryId} onValueChange={(v) => setCategoryId(v ?? "all")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categoryItems.map((it) => <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Label</Label>
            <Select items={labelItems} value={labelId} onValueChange={(v) => setLabelId(v ?? "all")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {labelItems.map((it) => <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Dari Tanggal</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Sampai Tanggal</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={resetAll} className="w-full"
              title="Kembali ke bulan berjalan (tgl 1 s/d akhir bulan) & hapus filter">
              <RotateCcw className="h-4 w-4" /> Reset (Bulan Ini)
            </Button>
          </div>
        </div>
        {filterActive && (
          <p className="text-xs text-muted-foreground">
            Catatan: kategori & label hanya dimiliki pengeluaran — penjualan & pembelian
            tidak ditampilkan selama filter ini aktif.
          </p>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState icon={ArrowLeftRight} title="Tidak ada transaksi"
              description="Tidak ada transaksi pada filter ini. Ubah rentang tanggal atau filternya." />
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Arah</TableHead>
                  <TableHead>Pihak</TableHead>
                  <TableHead>Wallet</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead className="text-right">Nominal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pg.paged.map((r) => (
                  <TableRow key={r.key}
                    className={r.isPiutang ? "bg-red-50 hover:bg-red-100/60 dark:bg-red-500/10 dark:hover:bg-red-500/15" : ""}>
                    <TableCell className="whitespace-nowrap">{formatDate(r.date)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary">{SOURCE_LABEL[r.source]}</Badge>
                        {r.isPiutang && (
                          <Badge className={SOFT_TONES.red}>Piutang</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {r.direction === "in" ? (
                        <span className="inline-flex items-center gap-1 text-sm text-emerald-600">
                          <ArrowDownCircle className="h-3.5 w-3.5" /> Masuk
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-sm text-destructive">
                          <ArrowUpCircle className="h-3.5 w-3.5" /> Keluar
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-1.5">
                        {r.labelColor && (
                          <span className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: r.labelColor }} />
                        )}
                        {r.party}
                      </span>
                    </TableCell>
                    <TableCell>{r.walletName}</TableCell>
                    <TableCell className="max-w-52 truncate text-muted-foreground">
                      {r.description || "-"}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${r.direction === "in" ? "text-emerald-600" : "text-destructive"}`}>
                      {r.direction === "in" ? "+" : "−"}{formatIDR(r.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationBar page={pg.page} totalPages={pg.totalPages}
              from={pg.from} to={pg.to} total={pg.total}
              onPageChange={pg.setPage} unit="transaksi" />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
