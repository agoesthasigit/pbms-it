"use client";

import { Fragment } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatIDR } from "@/lib/utils/currency";
import { ReportDownload } from "@/components/shared/report-download";
import { StatCard } from "@/components/shared/stat-card";
import { Percent, TrendingUp, ShoppingCart } from "lucide-react";
import type { MarginReport } from "@/types/reports";

export function MarginView({
  data, loading,
}: {
  data: MarginReport | null;
  loading: boolean;
}) {
  if (loading || !data) {
    return (
      <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
        Menghitung margin…
      </CardContent></Card>
    );
  }

  // Kelompokkan per client/proyek supaya mudah dibaca (mirip sheet Excel).
  const groups = [...new Set(data.rows.map((r) => r.group))];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Periode {data.period.from} s/d {data.period.to}
        </p>
        <ReportDownload href="/api/reports/margin"
          from={data.period.from} to={data.period.to} label="Unduh Analisa Margin" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Harga Jual" icon={TrendingUp} tone="emerald"
          accent="text-emerald-600" value={formatIDR(data.total_revenue)} />
        <StatCard label="Total Modal" icon={ShoppingCart} tone="blue"
          value={formatIDR(data.total_cost)} />
        <StatCard label="Total Margin" icon={Percent}
          tone={data.total_margin >= 0 ? "emerald" : "red"}
          accent={data.total_margin >= 0 ? "text-emerald-600" : "text-destructive"}
          value={formatIDR(data.total_margin)}
          hint={`${(data.total_margin_pct * 100).toFixed(1)}% dari harga jual`} />
      </div>

      <Card>
        <CardContent className="p-0">
          {data.rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Tidak ada penjualan atau proyek selesai pada periode ini.
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
                  const rows = data.rows.filter((r) => r.group === g);
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
                  <TableCell>TOTAL</TableCell>
                  <TableCell />
                  <TableCell className="text-right tabular-nums">{formatIDR(data.total_cost)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatIDR(data.total_revenue)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatIDR(data.total_margin)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {(data.total_margin_pct * 100).toFixed(1)}%
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
