"use client";

import { useEffect, useMemo, useState } from "react";
import {
  TrendingUp, ShoppingCart, TrendingDown, User2, Wallet, Percent,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { formatIDR } from "@/lib/utils/currency";

// Formatter tooltip Recharts yang aman terhadap tipe ValueType (bisa undefined)
const tipFormat = (v: unknown) => formatIDR(Number(v ?? 0));
import { StatCard } from "@/components/shared/stat-card";
import {
  PeriodPicker, presetThisMonth, type Period,
} from "@/components/shared/period-picker";
import type {
  FinanceSummary, MonthlyTrend, IncomeBreakdown, OpExpenseBreakdown,
} from "@/types/phase8";

const shortMonth = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { month: "short", year: "2-digit" });

export function ReportsClient() {
  const supabase = useMemo(() => createClient(), []);
  const [period, setPeriod] = useState<Period>(presetThisMonth());
  const [loading, setLoading] = useState(true);

  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [trend, setTrend] = useState<MonthlyTrend[]>([]);
  const [income, setIncome] = useState<IncomeBreakdown[]>([]);
  const [opExpense, setOpExpense] = useState<OpExpenseBreakdown[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [sumRes, trendRes, incRes, opRes] = await Promise.all([
        supabase.rpc("finance_summary", { p_from: period.from, p_to: period.to }),
        supabase.rpc("monthly_trend", { p_months: 12 }),
        supabase.rpc("income_breakdown", { p_from: period.from, p_to: period.to }),
        supabase.rpc("op_expense_breakdown", { p_from: period.from, p_to: period.to }),
      ]);
      if (!active) return;
      setSummary((sumRes.data?.[0] as FinanceSummary) ?? null);
      setTrend((trendRes.data as MonthlyTrend[]) ?? []);
      setIncome((incRes.data as IncomeBreakdown[]) ?? []);
      setOpExpense((opRes.data as OpExpenseBreakdown[]) ?? []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [supabase, period]);

  const totalSales = Number(summary?.total_sales ?? 0);
  const totalPurchase = Number(summary?.total_purchase ?? 0);
  const totalOpExpense = Number(summary?.total_op_expense ?? 0);
  const totalPersonal = Number(summary?.total_personal_expense ?? 0);
  const netProfit = Number(summary?.net_profit ?? 0);
  // margin = laba / total penjualan × 100
  const margin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;

  const dash = loading ? "…" : "";
  const trendData = trend.map((t) => ({
    name: shortMonth(t.month_start),
    Penjualan: Number(t.income),
    Pengeluaran: Number(t.op_expense),
    Laba: Number(t.net_profit),
  }));

  return (
    <div className="space-y-6">
      <PeriodPicker period={period} onChange={setPeriod} />

      {/* 6 kartu sesuai urutan permintaan */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total Penjualan" icon={TrendingUp} accent="text-success-strong"
          value={loading ? "…" : formatIDR(totalSales)} />
        <StatCard label="Total Pembelian" icon={ShoppingCart}
          value={loading ? "…" : formatIDR(totalPurchase)} />
        <StatCard label="Pengeluaran Operasional" icon={TrendingDown}
          value={loading ? "…" : formatIDR(totalOpExpense)} />
        <StatCard label="Pengeluaran Pribadi" icon={User2}
          value={loading ? "…" : formatIDR(totalPersonal)} />
        <StatCard label="Laba Bersih" icon={Wallet}
          accent={netProfit >= 0 ? "text-success-strong" : "text-destructive"}
          value={loading ? "…" : formatIDR(netProfit)} />
        <StatCard label="Margin Laba" icon={Percent}
          accent={margin >= 0 ? "text-success-strong" : "text-destructive"}
          value={loading ? "…" : `${margin.toFixed(1)}%`}
          hint="Laba ÷ Total Penjualan" />
      </div>

      {/* Rumus laba (informasi) */}
      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Laba Bersih</span> = Total Penjualan
            − Total Pembelian − Pengeluaran Operasional − Pengeluaran Pribadi
          </p>
          {!loading && (
            <p className="mt-1 text-xs text-muted-foreground">
              {formatIDR(totalSales)} − {formatIDR(totalPurchase)} − {formatIDR(totalOpExpense)}
              {" "}− {formatIDR(totalPersonal)} = <b className={netProfit >= 0 ? "text-success-strong" : "text-destructive"}>{formatIDR(netProfit)}</b>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Grafik penjualan vs pengeluaran per bulan */}
      <Card>
        <CardHeader><CardTitle className="text-base">Penjualan vs Pengeluaran per Bulan</CardTitle></CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={11} tickFormatter={(v: number) => `${(Number(v) / 1_000_000).toFixed(0)}jt`} />
                <Tooltip formatter={tipFormat as never} />
                <Legend />
                <Bar dataKey="Penjualan" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Pengeluaran" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Laba bersih per bulan */}
      <Card>
        <CardHeader><CardTitle className="text-base">Laba Bersih per Bulan</CardTitle></CardHeader>
        <CardContent>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={11} tickFormatter={(v: number) => `${(Number(v) / 1_000_000).toFixed(0)}jt`} />
                <Tooltip formatter={tipFormat as never} />
                <Bar dataKey="Laba" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Rincian pemasukan & pengeluaran operasional */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Rincian Pemasukan (per Sumber)</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sumber</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {income.length === 0 ? (
                  <TableRow><TableCell colSpan={2} className="py-6 text-center text-sm text-muted-foreground">
                    Tidak ada pemasukan pada periode ini.
                  </TableCell></TableRow>
                ) : (
                  income.map((r) => (
                    <TableRow key={r.source}>
                      <TableCell>{r.source}</TableCell>
                      <TableCell className="text-right font-medium text-success-strong">
                        {formatIDR(Number(r.total))}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Rincian Pengeluaran Operasional</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kategori</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {opExpense.length === 0 ? (
                  <TableRow><TableCell colSpan={2} className="py-6 text-center text-sm text-muted-foreground">
                    Tidak ada pengeluaran pada periode ini.
                  </TableCell></TableRow>
                ) : (
                  opExpense.map((r) => (
                    <TableRow key={r.category}>
                      <TableCell>{r.category}</TableCell>
                      <TableCell className="text-right font-medium text-destructive">
                        {formatIDR(Number(r.total))}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
