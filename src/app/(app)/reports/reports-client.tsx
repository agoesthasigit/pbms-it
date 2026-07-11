"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { formatIDR } from "@/lib/utils/currency";
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

  const totalIncome = Number(summary?.total_income ?? 0);
  const totalOpExpense = Number(summary?.total_op_expense ?? 0);
  const netProfit = Number(summary?.net_profit ?? 0);
  const margin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

  const trendData = trend.map((t) => ({
    name: shortMonth(t.month_start),
    Pemasukan: Number(t.income),
    Pengeluaran: Number(t.op_expense),
    Laba: Number(t.net_profit),
  }));

  return (
    <div className="space-y-6">
      <PeriodPicker period={period} onChange={setPeriod} />

      {/* Ringkasan */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Pendapatan" accent="text-emerald-600"
          value={loading ? "…" : formatIDR(totalIncome)} />
        <StatCard label="Total Pengeluaran"
          value={loading ? "…" : formatIDR(totalOpExpense)} />
        <StatCard label="Laba Bersih"
          accent={netProfit >= 0 ? "text-emerald-600" : "text-destructive"}
          value={loading ? "…" : formatIDR(netProfit)} />
        <StatCard label="Margin Laba"
          accent={margin >= 0 ? "text-emerald-600" : "text-destructive"}
          value={loading ? "…" : `${margin.toFixed(1)}%`} />
      </div>

      {/* Grafik pendapatan vs pengeluaran */}
      <Card>
        <CardHeader><CardTitle className="text-base">Pendapatan vs Pengeluaran per Bulan</CardTitle></CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}jt`} />
                <Tooltip formatter={(v: number) => formatIDR(v)} />
                <Legend />
                <Bar dataKey="Pemasukan" fill="#10b981" radius={[4, 4, 0, 0]} />
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
                <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}jt`} />
                <Tooltip formatter={(v: number) => formatIDR(v)} />
                <Bar dataKey="Laba" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Rincian pemasukan & pengeluaran */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Rincian Pemasukan</CardTitle></CardHeader>
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
                  <>
                    {income.map((r) => (
                      <TableRow key={r.source}>
                        <TableCell>{r.source}</TableCell>
                        <TableCell className="text-right font-medium text-emerald-600">
                          {formatIDR(Number(r.total))}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2">
                      <TableCell className="font-bold">Total</TableCell>
                      <TableCell className="text-right font-bold">{formatIDR(totalIncome)}</TableCell>
                    </TableRow>
                  </>
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
                  <>
                    {opExpense.map((r) => (
                      <TableRow key={r.category}>
                        <TableCell>{r.category}</TableCell>
                        <TableCell className="text-right font-medium text-destructive">
                          {formatIDR(Number(r.total))}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2">
                      <TableCell className="font-bold">Total</TableCell>
                      <TableCell className="text-right font-bold">{formatIDR(totalOpExpense)}</TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Catatan pengeluaran pribadi */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div>
            <p className="text-sm font-medium">Pengeluaran Pribadi (informasi)</p>
            <p className="text-xs text-muted-foreground">
              Tidak dihitung dalam laba bisnis, hanya mengurangi saldo wallet.
            </p>
          </div>
          <p className="text-lg font-bold">
            {loading ? "…" : formatIDR(Number(summary?.total_personal_expense ?? 0))}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
