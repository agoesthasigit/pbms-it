"use client";

import { Fragment, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatIDR } from "@/lib/utils/currency";
import { ReportDownload } from "@/components/shared/report-download";
import { StatCard } from "@/components/shared/stat-card";
import { Percent, TrendingUp, ShoppingCart, Search } from "lucide-react";
import type { MarginReport } from "@/types/reports";

export function MarginView({
  data, loading,
}: {
  data: MarginReport | null;
  loading: boolean;
}) {
  // Pencarian nama barang/item (Opsi Y: TOTAL & kartu ikut hasil filter).
  const [q, setQ] = useState("");

  // Baris yang ditampilkan + total & kartu dihitung ulang dari hasil filter.
  const view = useMemo(() => {
    const rows = data?.rows ?? [];
    const key = q.trim().toLowerCase();
    const filtered = key
      ? rows.filter((r) =>
          r.item.toLowerCase().includes(key) || r.group.toLowerCase().includes(key))
      : rows;
    const cost = filtered.reduce((s, r) => s + r.cost, 0);
    const revenue = filtered.reduce((s, r) => s + r.revenue, 0);
    const margin = filtered.reduce((s, r) => s + r.margin, 0);
    return {
      rows: filtered,
      cost,
      revenue,
      margin,
      marginPct: revenue > 0 ? margin / revenue : 0,
      active: key.length > 0,
    };
  }, [data, q]);

  if (loading || !data) {
    return (
      <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
        Menghitung margin…
      </CardContent></Card>
    );
  }

  // Kelompokkan per client/proyek supaya mudah dibaca (mirip sheet Excel).
  const groups = [...new Set(view.rows.map((r) => r.group))];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Periode {data.period.from} s/d {data.period.to}
        </p>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="w-full pl-9 sm:w-64" placeholder="Cari nama barang / client..."
              value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <ReportDownload href="/api/reports/margin"
            from={data.period.from} to={data.period.to} label="Unduh Analisa Margin" />
        </div>
      </div>

      {view.active && (
        <p className="text-xs text-muted-foreground">
          Menampilkan hasil pencarian <span className="font-medium text-foreground">&ldquo;{q}&rdquo;</span> —
          total &amp; kartu di bawah dihitung dari {view.rows.length} baris yang cocok.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Harga Jual" icon={TrendingUp} tone="emerald"
          accent="text-emerald-600" value={formatIDR(view.revenue)} />
        <StatCard label="Total Modal" icon={ShoppingCart} tone="blue"
          value={formatIDR(view.cost)} />
        <StatCard label="Total Margin" icon={Percent}
          tone={view.margin >= 0 ? "emerald" : "red"}
          accent={view.margin >= 0 ? "text-emerald-600" : "text-destructive"}
          value={formatIDR(view.margin)}
          hint={`${(view.marginPct * 100).toFixed(1)}% dari harga jual`} />
      </div>

      <Card>
        <CardContent className="p-0">
          {view.rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {view.active
                ? "Tidak ada item yang cocok dengan pencarian."
                : "Tidak ada penjualan atau proyek selesai pada periode ini."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-right">Harga Beli</TableHead>
                  <TableHead className="text-right">Harga Jual</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead className="text-right">Margin %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g) => {
                  const rows = view.rows.filter((r) => r.group === g);
                  return (
                    <Fragment key={g}>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableCell colSpan={6} className="py-1.5 text-xs font-semibold uppercase tracking-wide">
                          {g}
                        </TableCell>
                      </TableRow>
                      {rows.map((r, i) => (
                        <TableRow key={`${g}-${i}`}>
                          <TableCell className="pl-6">
                            {r.item}
                            {r.kind === "project" && (
                              <Badge variant="outline" className="ml-2 text-[10px]">Proyek selesai</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">{r.qty}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatIDR(r.cost)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatIDR(r.revenue)}</TableCell>
                          <TableCell className={`text-right font-medium tabular-nums ${
                            r.margin >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                          }`}>
                            {formatIDR(r.margin)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {(r.margin_pct * 100).toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  );
                })}
                <TableRow className="border-t-2 font-bold">
                  <TableCell>{view.active ? "TOTAL (hasil pencarian)" : "TOTAL"}</TableCell>
                  <TableCell />
                  <TableCell className="text-right tabular-nums">{formatIDR(view.cost)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatIDR(view.revenue)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatIDR(view.margin)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {(view.marginPct * 100).toFixed(1)}%
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ===== Rekonsiliasi invoice vs pembayaran diterima ===== */}
      <Card>
        <CardContent className="pt-5">
          <h3 className="text-sm font-bold uppercase tracking-wide">
            Rekonsiliasi Invoice vs Pembayaran Diterima
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            PPh 23 (2,5%) hanya atas nilai jasa; penjualan barang tidak kena.
          </p>
        </CardContent>
        <CardContent className="p-0">
          {data.recon.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              Belum ada invoice bulanan yang lunas pada periode ini.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Bruto</TableHead>
                  <TableHead className="text-right">Dasar Pajak (Jasa)</TableHead>
                  <TableHead className="text-right">PPh 2,5%</TableHead>
                  <TableHead className="text-right">Diterima (Netto)</TableHead>
                  <TableHead className="text-center">Cek</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recon.map((r) => (
                  <TableRow key={r.invoice_no}>
                    <TableCell className="font-medium">{r.invoice_no}</TableCell>
                    <TableCell>{r.client}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatIDR(r.bruto)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatIDR(r.dpp)}</TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">
                      {r.pph > 0 ? `− ${formatIDR(r.pph)}` : formatIDR(0)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatIDR(r.netto)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={r.ok
                        ? "border-emerald-300 text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-400"
                        : "border-destructive text-destructive"}>
                        {r.ok ? "OK" : "CEK"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 font-bold">
                  <TableCell colSpan={2}>TOTAL</TableCell>
                  <TableCell className="text-right tabular-nums">{formatIDR(data.recon_bruto)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatIDR(data.recon_dpp)}</TableCell>
                  <TableCell className="text-right tabular-nums text-destructive">
                    {data.recon_pph > 0 ? `− ${formatIDR(data.recon_pph)}` : formatIDR(0)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatIDR(data.recon_netto)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
