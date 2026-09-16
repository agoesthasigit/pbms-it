"use client";

import { useMemo, useState } from "react";
import { Search, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatIDR } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { usePagination } from "@/components/shared/use-pagination";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { ReportDownload } from "@/components/shared/report-download";
import { FilterSheet } from "@/components/mobile/filter-sheet";
import { type TxRow, TX_SOURCE_LABEL } from "@/types/reports";

type Opt = { value: string; label: string };

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function thisMonthRange() {
  const now = new Date();
  return {
    from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

export function TransactionListMobile({
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
        const hay = [r.party, r.description, r.walletName, TX_SOURCE_LABEL[r.source]]
          .join(" ").toLowerCase();
        if (!hay.includes(key)) return false;
      }
      return true;
    });
  }, [rows, from, to, dir, walletId, categoryId, labelId, q]);

  const counted = filtered.filter((r) => r.countInTotal !== false);
  const totalIn = counted.filter((r) => r.direction === "in").reduce((s, r) => s + r.amount, 0);
  const totalOut = counted.filter((r) => r.direction === "out").reduce((s, r) => s + r.amount, 0);
  const net = totalIn - totalOut;

  const pg = usePagination(filtered, 20,
    `${dir}|${walletId}|${categoryId}|${labelId}|${from}|${to}|${q}`);

  function resetAll() {
    setFrom(def.from); setTo(def.to); setDir("all");
    setWalletId("all"); setCategoryId("all"); setLabelId("all");
  }

  const activeCount =
    (dir !== "all" ? 1 : 0) + (walletId !== "all" ? 1 : 0) +
    (categoryId !== "all" ? 1 : 0) + (labelId !== "all" ? 1 : 0);

  return (
    <div className="space-y-3 lg:hidden">
      <h1 className="ma-h1">Riwayat Transaksi</h1>

      {/* Ringkasan kompak */}
      <div className="grid grid-cols-3 gap-2">
        <div className="ma-card p-3">
          <p className="text-[11px] font-medium text-muted-foreground">Masuk</p>
          <p className="ma-num mt-0.5 text-sm font-bold text-[var(--m-pos)]">
            {formatIDR(totalIn)}
          </p>
        </div>
        <div className="ma-card p-3">
          <p className="text-[11px] font-medium text-muted-foreground">Keluar</p>
          <p className="ma-num mt-0.5 text-sm font-bold text-[var(--m-neg)]">
            {formatIDR(totalOut)}
          </p>
        </div>
        <div className="ma-card p-3">
          <p className="text-[11px] font-medium text-muted-foreground">Net</p>
          <p className={"ma-num mt-0.5 text-sm font-bold " + (net >= 0 ? "text-[var(--m-pos)]" : "text-[var(--m-neg)]")}>
            {formatIDR(net)}
          </p>
        </div>
      </div>

      {/* Cari + filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-9 pl-9" placeholder="Cari pihak / barang..."
            value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <FilterSheet activeCount={activeCount} onReset={resetAll}>
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
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Dari</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sampai</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        </FilterSheet>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{filtered.length} transaksi</p>
        <ReportDownload href="/api/reports/transactions" from={from} to={to} label="Unduh" />
      </div>

      {/* Daftar */}
      {filtered.length === 0 ? (
        <div className="ma-card p-6 text-center text-sm text-muted-foreground">
          Tidak ada transaksi pada filter ini.
        </div>
      ) : (
        <>
          <ul className="ma-card ma-list">
            {pg.paged.map((r) => {
              const income = r.direction === "in";
              return (
                <li key={r.key} className="ma-row" style={r.isPiutang ? { background: "var(--m-neg-soft)" } : undefined}>
                  <span className={"ma-row-ic " + (income ? "pos" : "neg")}>
                    {income ? <ArrowDownLeft className="h-[19px] w-[19px]" /> : <ArrowUpRight className="h-[19px] w-[19px]" />}
                  </span>
                  <span className="ma-row-main">
                    <b className="flex items-center gap-1.5">
                      {r.labelColor && (
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: r.labelColor }} />
                      )}
                      {r.party}
                    </b>
                    <span>
                      {formatDate(r.date)} · {TX_SOURCE_LABEL[r.source]}
                      {r.walletName ? ` · ${r.walletName}` : ""}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <span className={"ma-num text-sm font-bold " + (income ? "text-[var(--m-pos)]" : "text-foreground")}>
                      {income ? "+" : "−"}{formatIDR(r.amount)}
                    </span>
                    {r.isPiutang && <span className="ma-badge neg">Piutang</span>}
                  </span>
                </li>
              );
            })}
          </ul>
          <PaginationBar page={pg.page} totalPages={pg.totalPages}
            from={pg.from} to={pg.to} total={pg.total}
            onPageChange={pg.setPage} unit="transaksi" />
        </>
      )}
    </div>
  );
}
