"use client";

import { useEffect, useMemo, useState } from "react";
import {
  TrendingUp, TrendingDown, Wallet, Users, FileText, ShieldAlert,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { formatIDR } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { StatCard } from "@/components/shared/stat-card";
import {
  PeriodPicker, presetThisMonth, type Period,
} from "@/components/shared/period-picker";
import type {
  FinanceSummary, MonthlyTrend, DashboardCounts,
} from "@/types/phase8";

type PendingInvoice = {
  id: string; invoice_no: string; company_name: string;
  total: number; due_date: string | null; effective_status: string;
};
type ExpiringAsset = {
  id: string; product_name: string; company_name: string;
  warranty_end: string; days_left: number;
};

const shortMonth = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { month: "short" });

export function DashboardClient() {
  const supabase = useMemo(() => createClient(), []);
  const [period, setPeriod] = useState<Period>(presetThisMonth());
  const [loading, setLoading] = useState(true);

  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [trend, setTrend] = useState<MonthlyTrend[]>([]);
  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>([]);
  const [expiringAssets, setExpiringAssets] = useState<ExpiringAsset[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [sumRes, trendRes, countRes, invRes, assetRes] = await Promise.all([
        supabase.rpc("finance_summary", { p_from: period.from, p_to: period.to }),
        supabase.rpc("monthly_trend", { p_months: 12 }),
        supabase.rpc("dashboard_counts"),
        supabase.from("v_monthly_invoices").select("id, invoice_no, company_name, total, due_date, effective_status")
          .neq("status", "paid").order("due_date", { ascending: true }).limit(5),
        supabase.from("v_client_assets").select("id, product_name, company_name, warranty_end, days_left")
          .eq("warranty_status", "expiring").order("days_left", { ascending: true }).limit(5),
      ]);
      if (!active) return;
      setSummary((sumRes.data?.[0] as FinanceSummary) ?? null);
      setTrend((trendRes.data as MonthlyTrend[]) ?? []);
      setCounts((countRes.data?.[0] as DashboardCounts) ?? null);
      setPendingInvoices((invRes.data as PendingInvoice[]) ?? []);
      setExpiringAssets((assetRes.data as ExpiringAsset[]) ?? []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [supabase, period]);

  const chartData = trend.map((t) => ({
    name: shortMonth(t.month_start),
    Pemasukan: Number(t.income),
    Pengeluaran: Number(t.op_expense),
    Laba: Number(t.net_profit),
  }));

  return (
    <div className="space-y-6">
      <PeriodPicker period={period} onChange={setPeriod} />

      {/* Kartu ringkasan */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Pemasukan" icon={TrendingUp}
          accent="text-emerald-600"
          value={loading ? "…" : formatIDR(Number(summary?.total_income ?? 0))} />
        <StatCard label="Pengeluaran Operasional" icon={TrendingDown}
          value={loading ? "…" : formatIDR(Number(summary?.total_op_expense ?? 0))} />
        <StatCard label="Pengeluaran Pribadi" icon={Wallet}
          hint="Tidak mengurangi laba bisnis"
          value={loading ? "…" : formatIDR(Number(summary?.total_personal_expense ?? 0))} />
        <StatCard label="Laba Bersih" icon={TrendingUp}
          accent={Number(summary?.net_profit ?? 0) >= 0 ? "text-emerald-600" : "text-destructive"}
          value={loading ? "…" : formatIDR(Number(summary?.net_profit ?? 0))} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Client Aktif" icon={Users}
          value={loading ? "…" : String(counts?.active_clients ?? 0)} />
        <StatCard label="Invoice Pending" icon={FileText}
          value={loading ? "…" : String(counts?.pending_invoices ?? 0)}
          hint={counts ? `Piutang ${formatIDR(Number(counts.total_receivable))}` : undefined} />
        <StatCard label="Garansi < 30 Hari" icon={ShieldAlert}
          accent={Number(counts?.expiring_warranty ?? 0) > 0 ? "text-amber-600" : undefined}
          value={loading ? "…" : String(counts?.expiring_warranty ?? 0)} />
        <StatCard label="Total Pembelian" icon={TrendingDown}
          value={loading ? "…" : formatIDR(Number(summary?.total_purchase ?? 0))} />
      </div>

      {/* Grafik tren */}
      <Card>
        <CardHeader><CardTitle className="text-base">Tren Keuangan (12 Bulan)</CardTitle></CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={11}
                  tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}jt`} />
                <Tooltip formatter={(v: number) => formatIDR(v)} />
                <Legend />
                <Line type="monotone" dataKey="Pemasukan" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Pengeluaran" stroke="#ef4444" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Laba" stroke="#0ea5e9" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Invoice tertunda + garansi akan habis */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Invoice Tertunda</CardTitle>
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/invoices" />}>
              Semua <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            {pendingInvoices.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Tidak ada invoice tertunda.</p>
            ) : (
              <ul className="divide-y">
                {pendingInvoices.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium">{inv.company_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {inv.invoice_no}
                        {inv.due_date && ` · tempo ${formatDate(inv.due_date)}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatIDR(Number(inv.total))}</p>
                      {inv.effective_status === "overdue" && (
                        <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Jatuh tempo</Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Garansi Akan Habis</CardTitle>
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/assets" />}>
              Semua <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            {expiringAssets.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Tidak ada garansi mendekati habis.</p>
            ) : (
              <ul className="divide-y">
                {expiringAssets.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium">{a.product_name}</p>
                      <p className="text-xs text-muted-foreground">{a.company_name}</p>
                    </div>
                    <div className="text-right">
                      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                        {a.days_left} hari
                      </Badge>
                      <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(a.warranty_end)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
