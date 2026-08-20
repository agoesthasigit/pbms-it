"use client";

import { useEffect, useMemo, useState } from "react";
import {
  TrendingUp, ShoppingCart, TrendingDown, User2, Wallet, Percent,
  ArrowUpRight, ArrowDownRight, Receipt, Info,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import { Gauge } from "@/components/shared/gauge";
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
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  PeriodPicker, presetThisMonth, type Period,
} from "@/components/shared/period-picker";
import type {
  FinanceSummary, MonthlyTrend, IncomeBreakdown, OpExpenseBreakdown,
} from "@/types/phase8";
import type { ProfitLoss, MarginReport, ProfitTrendPoint } from "@/types/reports";
import { ProfitLossView } from "./profit-loss-view";
import { MarginView } from "./margin-view";
import { getProfitLoss, getMarginReport, getProfitLossTrend } from "./actions";

const shortMonth = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { month: "short", year: "2-digit" });

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

// Format ringkas Rupiah untuk ruang sempit (kartu gauge & legenda donut).
function compactIDR(v: number): string {
  const a = Math.abs(v);
  const s = v < 0 ? "-" : "";
  if (a >= 1e9) return `${s}Rp ${(a / 1e9).toFixed(1)} M`;
  if (a >= 1e6) return `${s}Rp ${(a / 1e6).toFixed(1)} jt`;
  if (a >= 1e3) return `${s}Rp ${(a / 1e3).toFixed(0)} rb`;
  return `${s}Rp ${a}`;
}

// Periode sebelumnya yang setara panjangnya (untuk pembanding %).
function prevPeriod(p: Period): Period {
  const from = new Date(`${p.from}T00:00:00`);
  const to = new Date(`${p.to}T00:00:00`);
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  const prevTo = new Date(from.getTime() - 86_400_000);
  const prevFrom = new Date(prevTo.getTime() - (days - 1) * 86_400_000);
  const f = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: f(prevFrom), to: f(prevTo) };
}

const PIE_COLORS = [
  "#ef4444", "#22c55e", "#3b82f6", "#f59e0b",
  "#8b5cf6", "#ec4899", "#14b8a6", "#64748b",
];

type RecordRow = {
  id: string; kind: "op" | "personal";
  amount: number; created_at: string; category: string; wallet: string;
};
type ExpRow = {
  amount: number; category: { name: string } | null;
};
type LastRow = {
  id: string; amount: number; created_at: string;
  category: { name: string } | null; wallet: { name: string } | null;
};

export function ReportsClient() {
  const supabase = useMemo(() => createClient(), []);
  const [period, setPeriod] = useState<Period>(presetThisMonth());
  const [loading, setLoading] = useState(true);

  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [trend, setTrend] = useState<MonthlyTrend[]>([]);
  const [income, setIncome] = useState<IncomeBreakdown[]>([]);
  const [opExpense, setOpExpense] = useState<OpExpenseBreakdown[]>([]);
  const [balance, setBalance] = useState(0);
  const [prevSpending, setPrevSpending] = useState(0);
  const [catBreakdown, setCatBreakdown] = useState<{ name: string; value: number }[]>([]);
  const [lastRecords, setLastRecords] = useState<RecordRow[]>([]);
  const [pl, setPl] = useState<ProfitLoss | null>(null);
  // Tren laba AKRUAL 12 bulan (sumber sama dgn Laba Rugi) untuk grafik Ringkasan.
  const [profitTrend, setProfitTrend] = useState<ProfitTrendPoint[]>([]);
  const [marginReport, setMarginReport] = useState<MarginReport | null>(null);

  // Laba Rugi & Analisa Margin dihitung di server (server action) supaya
  // rumusnya sama persis dengan yang dipakai route export Excel/PDF.
  useEffect(() => {
    let active = true;
    (async () => {
      const [plRes, mRes, trendRes] = await Promise.all([
        getProfitLoss(period.from, period.to),
        getMarginReport(period.from, period.to),
        getProfitLossTrend(12),
      ]);
      if (!active) return;
      setPl(plRes);
      setMarginReport(mRes);
      setProfitTrend(trendRes);
    })();
    return () => { active = false; };
  }, [period]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const pv = prevPeriod(period);
      const catSel = "amount, category:categories(name)";
      const lastSel = "id, amount, created_at, category:categories(name), wallet:wallets(name)";
      const [
        sumRes, trendRes, incRes, opRes,
        balRes, prevRes, opRowsRes, persRowsRes, opLastRes, persLastRes,
      ] = await Promise.all([
        supabase.rpc("finance_summary", { p_from: period.from, p_to: period.to }),
        supabase.rpc("monthly_trend", { p_months: 12 }),
        supabase.rpc("income_breakdown", { p_from: period.from, p_to: period.to }),
        supabase.rpc("op_expense_breakdown", { p_from: period.from, p_to: period.to }),
        supabase.from("v_wallet_balances").select("balance"),
        supabase.rpc("finance_summary", { p_from: pv.from, p_to: pv.to }),
        supabase.from("operational_expenses").select(catSel)
          .gte("expense_date", period.from).lte("expense_date", period.to),
        supabase.from("personal_expenses").select(catSel)
          .gte("expense_date", period.from).lte("expense_date", period.to),
        supabase.from("operational_expenses").select(lastSel)
          .order("created_at", { ascending: false }).limit(5),
        supabase.from("personal_expenses").select(lastSel)
          .order("created_at", { ascending: false }).limit(5),
      ]);
      if (!active) return;
      setSummary((sumRes.data?.[0] as FinanceSummary) ?? null);
      setTrend((trendRes.data as MonthlyTrend[]) ?? []);
      setIncome((incRes.data as IncomeBreakdown[]) ?? []);
      setOpExpense((opRes.data as OpExpenseBreakdown[]) ?? []);

      setBalance(((balRes.data ?? []) as { balance: number }[])
        .reduce((s, w) => s + Number(w.balance), 0));

      const prev = (prevRes.data?.[0] as FinanceSummary) ?? null;
      setPrevSpending(Number(prev?.total_op_expense ?? 0) + Number(prev?.total_personal_expense ?? 0));

      // Gabung kategori operasional + pribadi untuk donut.
      const map = new Map<string, number>();
      for (const r of [...(opRowsRes.data ?? []), ...(persRowsRes.data ?? [])] as unknown as ExpRow[]) {
        const name = r.category?.name ?? "Tanpa kategori";
        map.set(name, (map.get(name) ?? 0) + Number(r.amount));
      }
      setCatBreakdown([...map.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value));

      // Gabung transaksi terakhir dari kedua tabel, urut terbaru, ambil 5.
      const toRec = (rows: unknown, kind: "op" | "personal"): RecordRow[] =>
        ((rows ?? []) as LastRow[]).map((r) => ({
          id: r.id, kind, amount: Number(r.amount), created_at: r.created_at,
          category: r.category?.name ?? "Tanpa kategori", wallet: r.wallet?.name ?? "-",
        }));
      setLastRecords([...toRec(opLastRes.data, "op"), ...toRec(persLastRes.data, "personal")]
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .slice(0, 5));

      setLoading(false);
    })();
    return () => { active = false; };
  }, [supabase, period]);

  const totalSales = Number(summary?.total_sales ?? 0);
  const totalPurchase = Number(summary?.total_purchase ?? 0);
  const totalOpExpense = Number(summary?.total_op_expense ?? 0);
  const totalPersonal = Number(summary?.total_personal_expense ?? 0);
  // Laba & margin memakai LABA AKRUAL (buildProfitLoss) — sumber sama dengan tab
  // "Laba Rugi", bukan lagi finance_summary (kas) yang bisa beda dari kenyataan.
  const netProfit = Number(pl?.net_profit ?? 0);
  const revenueAccrual = Number(pl?.revenue_total ?? 0);
  const cogsAccrual = Number(pl?.cogs_total ?? 0);
  const pphAccrual = Number(pl?.pph_total ?? 0);
  const personalAccrual = Number(pl?.personal_total ?? 0);
  // biaya operasional murni (tanpa pribadi & PPh) = opex_total − pribadi − PPh
  const opexOnlyAccrual = pl ? pl.opex_total - pl.personal_total - pl.pph_total : 0;
  // margin = laba / pendapatan (akrual) × 100
  const margin = revenueAccrual > 0 ? (netProfit / revenueAccrual) * 100 : 0;

  // ── Gauge (metrik KAS/likuiditas; skala auto dari riwayat 12 bulan) ────────
  const spending = totalOpExpense + totalPersonal;
  // CASH FLOW memakai laba KAS (finance_summary) — gauge ini memang metrik kas,
  // sengaja dibedakan dari kartu "Laba Bersih" (akrual) di atas.
  const cashFlow = Number(summary?.net_profit ?? 0);
  const monthlyOp = trend.map((t) => Number(t.op_expense));
  const monthlyNet = trend.map((t) => Number(t.net_profit));
  const spendMax = Math.max(1, ...monthlyOp, spending);
  const cfBound = Math.max(1, ...monthlyNet.map(Math.abs), Math.abs(cashFlow));
  const avgMonthlySpend = monthlyOp.length
    ? monthlyOp.reduce((s, v) => s + v, 0) / monthlyOp.length : 0;
  // "runway" = berapa bulan saldo bertahan pada rata-rata pengeluaran; penuh di ≥6 bln
  const runway = avgMonthlySpend > 0 ? balance / avgMonthlySpend : 6;

  // pembanding pengeluaran vs periode sebelumnya
  const spendPercent = prevSpending > 0
    ? ((spending - prevSpending) / prevSpending) * 100
    : (spending > 0 ? 100 : null);
  const spendUp = (spendPercent ?? 0) >= 0;

  const gauges = [
    { label: "BALANCE", value: runway, min: 0, max: 6, text: compactIDR(balance), reverse: false },
    { label: "CASH FLOW", value: cashFlow, min: -cfBound, max: cfBound, text: compactIDR(cashFlow), reverse: false },
    { label: "SPENDING", value: spending, min: 0, max: spendMax, text: compactIDR(-spending), reverse: true },
  ];

  // Penanda: gauge CASH FLOW (kas) bisa berbeda dari kartu Laba Bersih (akrual).
  // Muncul HANYA saat benar-benar ada selisih di layar; hilang sendiri saat 0
  // (mis. bulan tanpa uang muka proyek & tanpa penumpukan stok).
  const cashGap = Math.round(cashFlow - netProfit);
  const ongoingProjects = pl?.ongoing ?? [];
  const showCashNote = !loading && !!pl && cashGap !== 0;

  const dash = loading ? "…" : "";
  // Grafik bulanan memakai laba AKRUAL: revenue − expense = net (ketiganya cocok).
  const trendData = profitTrend.map((t) => ({
    name: shortMonth(t.month_start),
    Penjualan: t.revenue,
    Pengeluaran: t.expense,
    Laba: t.net,
  }));

  return (
    <div className="space-y-6">
      <PeriodPicker period={period} onChange={setPeriod} />

      <Tabs defaultValue="ringkasan">
        <TabsList>
          <TabsTrigger value="ringkasan">Ringkasan</TabsTrigger>
          <TabsTrigger value="labarugi">Laba Rugi</TabsTrigger>
          <TabsTrigger value="margin">Analisa Margin</TabsTrigger>
        </TabsList>

        <TabsContent value="ringkasan" className="space-y-6 pt-2">

      {/* 6 kartu sesuai urutan permintaan */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total Penjualan" icon={TrendingUp} accent="text-emerald-600" tone="emerald"
          value={loading ? "…" : formatIDR(totalSales)} />
        <StatCard label="Total Pembelian" icon={ShoppingCart} tone="blue"
          value={loading ? "…" : formatIDR(totalPurchase)} />
        <StatCard label="Pengeluaran Operasional" icon={TrendingDown} tone="orange"
          value={loading ? "…" : formatIDR(totalOpExpense)} />
        <StatCard label="Pengeluaran Pribadi" icon={User2} tone="teal"
          value={loading ? "…" : formatIDR(totalPersonal)} />
        <StatCard label="Laba Bersih" icon={Wallet}
          hint="Akrual — sama dengan tab Laba Rugi"
          accent={netProfit >= 0 ? "text-emerald-600" : "text-destructive"}
          tone={netProfit >= 0 ? "emerald" : "red"}
          value={loading || !pl ? "…" : formatIDR(netProfit)} />
        <StatCard label="Margin Laba" icon={Percent}
          accent={margin >= 0 ? "text-emerald-600" : "text-destructive"}
          tone={margin >= 0 ? "emerald" : "red"}
          value={loading || !pl ? "…" : `${margin.toFixed(1)}%`}
          hint="Laba ÷ Pendapatan (akrual)" />
      </div>

      {/* Rumus laba (informasi) */}
      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Laba Bersih (akrual)</span> = Pendapatan
            − HPP barang terjual − Biaya Operasional − Pengeluaran Pribadi
            {pphAccrual > 0 ? " − PPh 23" : ""}
          </p>
          {!loading && pl && (
            <p className="mt-1 text-xs text-muted-foreground">
              {formatIDR(revenueAccrual)} − {formatIDR(cogsAccrual)} − {formatIDR(opexOnlyAccrual)}
              {" "}− {formatIDR(personalAccrual)}
              {pphAccrual > 0 ? ` − ${formatIDR(pphAccrual)}` : ""}
              {" "}= <b className={netProfit >= 0 ? "text-emerald-600" : "text-destructive"}>{formatIDR(netProfit)}</b>
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Pendapatan &amp; HPP memakai barang yang benar-benar terjual (bukan total
            pembelian); termin proyek yang belum selesai tidak diakui. Sama persis dengan
            tab <span className="font-medium">Laba Rugi</span>.
          </p>
        </CardContent>
      </Card>

      {/* Grafik penjualan vs pengeluaran per bulan */}
      <Card>
        <CardHeader><CardTitle className="text-base">Penjualan vs Pengeluaran per Bulan</CardTitle></CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" fontSize={12}
                  stroke="var(--muted-foreground)" tick={{ fill: "var(--muted-foreground)" }} />
                <YAxis fontSize={11} stroke="var(--muted-foreground)" tick={{ fill: "var(--muted-foreground)" }}
                  tickFormatter={(v: number) => `${(Number(v) / 1_000_000).toFixed(0)}jt`} />
                <Tooltip formatter={tipFormat as never} cursor={{ fill: "var(--muted)" }}
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" }} />
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
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" fontSize={12}
                  stroke="var(--muted-foreground)" tick={{ fill: "var(--muted-foreground)" }} />
                <YAxis fontSize={11} stroke="var(--muted-foreground)" tick={{ fill: "var(--muted-foreground)" }}
                  tickFormatter={(v: number) => `${(Number(v) / 1_000_000).toFixed(0)}jt`} />
                <Tooltip formatter={tipFormat as never} cursor={{ fill: "var(--muted)" }}
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" }} />
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
                      <TableCell className="text-right font-medium text-emerald-600">
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

      {/* Dashboard visual: gauge, struktur pengeluaran, transaksi terakhir */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Gauge */}
        <Card>
          <CardHeader><CardTitle className="text-base">Dashboard</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {gauges.map((g) => (
                <div key={g.label} className="text-center">
                  <Gauge value={g.value} min={g.min} max={g.max} reverse={g.reverse} />
                  <p className="mt-1 text-[10px] font-medium tracking-wide text-muted-foreground">
                    {g.label}
                  </p>
                  <p className="text-sm font-bold">{loading ? "…" : g.text}</p>
                </div>
              ))}
            </div>

            {/* Penanda: CASH FLOW (kas) beda dari Laba Bersih (akrual) — muncul
                hanya saat ada selisih, mis. ada uang muka proyek berjalan. */}
            {showCashNote && (
              <div className="mt-3 flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-xs">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                <div className="space-y-1">
                  <p>
                    <b>CASH FLOW</b> di atas adalah angka <b>kas</b> — beda{" "}
                    {formatIDR(Math.abs(cashGap))} dari <b>Laba Bersih</b> (akrual).
                  </p>
                  {ongoingProjects.length > 0 && (
                    <p>
                      Sebabnya ada <b>proyek berjalan</b> yang masih menahan uang belum
                      jadi laba (sisa uang muka setelah biaya)
                      {ongoingProjects.map((p, i) => (
                        <span key={p.id}>
                          {i === 0 ? ": " : ", "}
                          {p.project_name} {formatIDR(p.remaining)}
                        </span>
                      ))}
                      . Diakui sebagai laba saat proyek selesai.
                    </p>
                  )}
                  <p className="text-muted-foreground">
                    Laba yang benar mengikuti kartu <b>Laba Bersih</b>.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Struktur pengeluaran (donut) */}
        <Card>
          <CardHeader><CardTitle className="text-base">Struktur Pengeluaran</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Periode ini</p>
                <p className="text-xl font-bold text-destructive">
                  {loading ? "…" : compactIDR(-spending)}
                </p>
              </div>
              {spendPercent !== null && (
                <div className={`flex items-center gap-1 text-sm font-semibold ${spendUp ? "text-red-600" : "text-emerald-600"}`}>
                  {spendUp ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  {Math.abs(spendPercent).toFixed(0)}%
                  <span className="text-xs font-normal text-muted-foreground">vs sebelumnya</span>
                </div>
              )}
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div className="h-40 w-40 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={catBreakdown} dataKey="value" nameKey="name"
                      innerRadius={45} outerRadius={70} paddingAngle={2} stroke="none">
                      {catBreakdown.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={tipFormat as never} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="flex-1 space-y-1.5 text-sm">
                {catBreakdown.slice(0, 5).map((c, i) => (
                  <li key={c.name} className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="truncate">{c.name}</span>
                    </span>
                    <span className="shrink-0 text-muted-foreground">{compactIDR(c.value)}</span>
                  </li>
                ))}
                {catBreakdown.length === 0 && !loading && (
                  <li className="text-muted-foreground">Tidak ada pengeluaran.</li>
                )}
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Transaksi terakhir */}
        <Card>
          <CardHeader><CardTitle className="text-base">Transaksi Terakhir</CardTitle></CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {lastRecords.map((r) => (
                <li key={`${r.kind}-${r.id}`} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <Receipt className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.category}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.wallet} · {r.kind === "op" ? "Operasional" : "Pribadi"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-destructive">-{formatIDR(r.amount)}</p>
                    <p className="text-xs text-muted-foreground">{dateTime(r.created_at)}</p>
                  </div>
                </li>
              ))}
              {lastRecords.length === 0 && !loading && (
                <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Belum ada transaksi.
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

        </TabsContent>

        <TabsContent value="labarugi" className="pt-2">
          <ProfitLossView data={pl} loading={pl === null} />
        </TabsContent>

        <TabsContent value="margin" className="pt-2">
          <MarginView data={marginReport} loading={marginReport === null} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
