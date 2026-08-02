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
    </div>
  );
}
