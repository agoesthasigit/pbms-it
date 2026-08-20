"use client";

import { useEffect, useMemo, useState } from "react";
import {
  TrendingUp, TrendingDown, Wallet, Users, FileText, ShieldAlert,
  ArrowRight, ShoppingCart, User2, HandCoins,
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

// Formatter tooltip Recharts yang aman terhadap tipe ValueType (bisa undefined)
const tipFormat = (v: unknown) => formatIDR(Number(v ?? 0));
import { formatDate } from "@/lib/utils/date";
import { StatCard } from "@/components/shared/stat-card";
import {
  PeriodPicker, presetThisMonth, type Period,
} from "@/components/shared/period-picker";
import type {
  FinanceSummary, DashboardCounts,
} from "@/types/phase8";
import type { ProfitLoss, ProfitTrendPoint } from "@/types/reports";
import { getProfitLoss, getProfitLossTrend } from "../reports/actions";

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
  // Laba bersih & margin memakai LABA AKRUAL (buildProfitLoss), sumber yang sama
  // dengan Laporan Laba Rugi — bukan lagi finance_summary (metode kas).
  const [pl, setPl] = useState<ProfitLoss | null>(null);
  const [profitTrend, setProfitTrend] = useState<ProfitTrendPoint[]>([]);
  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>([]);
  const [expiringAssets, setExpiringAssets] = useState<ExpiringAsset[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [sumRes, plRes, countRes, invRes, assetRes] = await Promise.all([
        supabase.rpc("finance_summary", { p_from: period.from, p_to: period.to }),
        getProfitLoss(period.from, period.to),
        supabase.rpc("dashboard_counts"),
        supabase.from("v_monthly_invoices").select("id, invoice_no, company_name, total, due_date, effective_status")
          .neq("status", "paid").order("due_date", { ascending: true }).limit(5),
        supabase.from("v_client_assets").select("id, product_name, company_name, warranty_end, days_left")
          .eq("warranty_status", "expiring").order("days_left", { ascending: true }).limit(5),
      ]);
      if (!active) return;
      setSummary((sumRes.data?.[0] as FinanceSummary) ?? null);
      setPl(plRes);
      setCounts((countRes.data?.[0] as DashboardCounts) ?? null);
      setPendingInvoices((invRes.data as PendingInvoice[]) ?? []);
      setExpiringAssets((assetRes.data as ExpiringAsset[]) ?? []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [supabase, period]);

  // Grafik tren 12 bulan memakai laba AKRUAL (independen dari periode kartu).
  useEffect(() => {
    let active = true;
    (async () => {
      const points = await getProfitLossTrend(12);
      if (active) setProfitTrend(points);
    })();
    return () => { active = false; };
  }, []);

  const chartData = profitTrend.map((t) => ({
    name: shortMonth(t.month_start),
    Penjualan: t.revenue,
    Pengeluaran: t.expense,
    Laba: t.net,
  }));

  return (
    <div className="space-y-6">
      <PeriodPicker period={period} onChange={setPeriod} />

      {/* Kartu ringkasan keuangan — aturan laba baru */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total Penjualan" icon={TrendingUp} accent="text-emerald-600" tone="emerald"
          value={loading ? "…" : formatIDR(Number(summary?.total_sales ?? 0))} />
        <StatCard label="Total Pembelian" icon={ShoppingCart} tone="blue"
          value={loading ? "…" : formatIDR(Number(summary?.total_purchase ?? 0))} />
        <StatCard label="Pengeluaran Operasional" icon={TrendingDown} tone="orange"
          value={loading ? "…" : formatIDR(Number(summary?.total_op_expense ?? 0))} />
        <StatCard label="Pengeluaran Pribadi" icon={User2} tone="teal"
          value={loading ? "…" : formatIDR(Number(summary?.total_personal_expense ?? 0))} />
        <StatCard label="Laba Bersih" icon={Wallet}
          hint="Akrual — sama dengan Laporan Laba Rugi"
          accent={Number(pl?.net_profit ?? 0) >= 0 ? "text-emerald-600" : "text-destructive"}
          tone={Number(pl?.net_profit ?? 0) >= 0 ? "emerald" : "red"}
          value={loading || !pl ? "…" : formatIDR(pl.net_profit)} />
        <StatCard label="Saldo Wallet Masuk" icon={Wallet} tone="teal"
          hint="Uang yang benar-benar diterima"
          value={loading ? "…" : formatIDR(Number(summary?.total_income ?? 0))} />
      </div>

      {/* Kartu operasional */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Piutang (belum diterima)" icon={HandCoins} tone="amber" accent="text-amber-600"
          value={loading ? "…" : formatIDR(Number(counts?.total_receivable ?? 0))}
          hint={counts ? `${counts.pending_invoices} invoice pending` : undefined} />
        <StatCard label="Hutang (belum dibayar)" icon={ShoppingCart} tone="orange" accent="text-orange-600"
          value={loading ? "…" : formatIDR(Number(counts?.total_payable ?? 0))}
          hint="Ke distributor" />
        <StatCard label="Client Aktif" icon={Users} tone="teal"
          value={loading ? "…" : String(counts?.active_clients ?? 0)} />
        <StatCard label="Garansi < 30 Hari" icon={ShieldAlert} tone="orange"
          accent={Number(counts?.expiring_warranty ?? 0) > 0 ? "text-amber-600" : undefined}
          value={loading ? "…" : String(counts?.expiring_warranty ?? 0)} />
        <StatCard label="Margin Laba" icon={TrendingUp} tone="emerald"
          value={loading || !pl || pl.revenue_total === 0 ? "—"
            : `${((pl.net_profit / pl.revenue_total) * 100).toFixed(1)}%`} />
      </div>

      {/* Grafik tren */}
      <Card>
        <CardHeader><CardTitle className="text-base">Tren Keuangan (12 Bulan)</CardTitle></CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" fontSize={12}
                  stroke="var(--muted-foreground)" tick={{ fill: "var(--muted-foreground)" }} />
                <YAxis fontSize={11}
                  stroke="var(--muted-foreground)" tick={{ fill: "var(--muted-foreground)" }}
                  tickFormatter={(v: number) => `${(Number(v) / 1_000_000).toFixed(0)}jt`} />
                <Tooltip formatter={tipFormat as never}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--popover-foreground)",
                  }} />
                <Legend />
                <Line type="monotone" dataKey="Penjualan" stroke="#10b981" strokeWidth={2} dot={false} />
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
                        <Badge className="bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-500/15 dark:text-red-400 dark:hover:bg-red-500/15">Jatuh tempo</Badge>
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
                      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400 dark:hover:bg-amber-500/15">
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
