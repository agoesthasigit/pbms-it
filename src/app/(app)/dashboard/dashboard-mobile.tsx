"use client";

import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  ReceiptText,
  FileText,
  LayoutGrid,
  HandCoins,
  Wallet,
  Users,
  ShieldAlert,
  User2,
  ChevronRight,
} from "lucide-react";
import { formatIDR, formatIDRShort } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import {
  presetThisMonth,
  presetLastMonth,
  presetThisYear,
  type Period,
} from "@/components/shared/period-picker";
import type { FinanceSummary, DashboardCounts } from "@/types/phase8";
import type { ProfitLoss, ProfitTrendPoint } from "@/types/reports";

// Tipe dipakai bersama dengan dashboard-client (desktop). Didefinisikan di sini
// untuk menghindari impor melingkar (client meng-impor mobile, bukan sebaliknya).
export type PendingInvoice = {
  id: string;
  invoice_no: string;
  company_name: string;
  total: number;
  due_date: string | null;
  effective_status: string;
};
export type ExpiringAsset = {
  id: string;
  product_name: string;
  company_name: string;
  warranty_end: string;
  days_left: number;
};

type Props = {
  loading: boolean;
  period: Period;
  onPeriodChange: (p: Period) => void;
  summary: FinanceSummary | null;
  pl: ProfitLoss | null;
  counts: DashboardCounts | null;
  profitTrend: ProfitTrendPoint[];
  pendingInvoices: PendingInvoice[];
  expiringAssets: ExpiringAsset[];
};

const PRESETS = [
  { label: "Bulan Ini", get: presetThisMonth },
  { label: "Bulan Lalu", get: presetLastMonth },
  { label: "Tahun Ini", get: presetThisYear },
] as const;

const shortMonth = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { month: "short" });

// Sparkline area sederhana untuk tren laba (net) 12 bulan.
function Sparkline({ points }: { points: ProfitTrendPoint[] }) {
  if (points.length < 2) {
    return (
      <div className="grid h-[74px] place-items-center text-xs text-muted-foreground">
        Data tren belum cukup.
      </div>
    );
  }
  const W = 300;
  const H = 74;
  const pad = 6;
  const vals = points.map((p) => p.net);
  const yMin = Math.min(0, ...vals);
  const yMax = Math.max(0, ...vals);
  const span = yMax - yMin || 1;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => pad + (1 - (v - yMin) / span) * (H - pad * 2);
  const line = points.map((p, i) => `${x(i)},${y(p.net)}`).join(" ");
  const area = `${x(0)},${H} ${line} ${x(points.length - 1)},${H}`;
  const last = points[points.length - 1];
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="mt-1.5 block h-[74px] w-full"
    >
      <defs>
        <linearGradient id="ma-spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--m-teal)" stopOpacity="0.32" />
          <stop offset="1" stopColor="var(--m-teal)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#ma-spark)" />
      <polyline
        points={line}
        fill="none"
        stroke="var(--m-teal)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={x(points.length - 1)} cy={y(last.net)} r="4" fill="var(--m-teal)" />
    </svg>
  );
}

export function DashboardMobile({
  loading,
  period,
  onPeriodChange,
  summary,
  pl,
  counts,
  profitTrend,
  pendingInvoices,
  expiringAssets,
}: Props) {
  const money = (n: number | null | undefined) =>
    loading ? "…" : formatIDR(Number(n ?? 0));

  const netProfit = Number(pl?.net_profit ?? 0);
  const revenue = Number(pl?.revenue_total ?? 0);
  const marginPct = revenue > 0 ? (netProfit / revenue) * 100 : null;
  const pengeluaran =
    Number(summary?.total_op_expense ?? 0) +
    Number(summary?.total_personal_expense ?? 0);

  const activeIdx = PRESETS.findIndex((p) => {
    const x = p.get();
    return x.from === period.from && x.to === period.to;
  });

  const summaryRows = [
    { label: "Penjualan", icon: ReceiptText, tone: "pos", value: money(summary?.total_sales) },
    { label: "Pembelian", icon: ShoppingCart, tone: "teal", value: money(summary?.total_purchase) },
    { label: "Beban Operasional", icon: TrendingDown, tone: "amber", value: money(summary?.total_op_expense) },
    { label: "Pengeluaran Pribadi", icon: User2, tone: "amber", value: money(summary?.total_personal_expense) },
    { label: "Client Aktif", icon: Users, tone: "teal", value: loading ? "…" : String(counts?.active_clients ?? 0) },
    {
      label: "Garansi < 30 Hari",
      icon: ShieldAlert,
      tone: "neg",
      value: loading ? "…" : String(counts?.expiring_warranty ?? 0),
    },
  ] as const;

  return (
    <div className="space-y-5">
      {/* Periode */}
      <div className="flex gap-2">
        {PRESETS.map((p, i) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onPeriodChange(p.get())}
            className={
              "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors " +
              (i === activeIdx
                ? "border-transparent bg-[var(--m-teal-deep)] text-white"
                : "border-border bg-card text-muted-foreground")
            }
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Hero: Laba Bersih */}
      <div className="ma-hero">
        <div className="ma-hero-top">
          <span>Laba Bersih · periode ini</span>
          <Wallet className="h-[17px] w-[17px] opacity-80" />
        </div>
        <div className="ma-hero-bal ma-num">{loading || !pl ? "…" : formatIDR(netProfit)}</div>
        <div className="ma-hero-sub">
          {netProfit >= 0 ? (
            <TrendingUp className="h-3.5 w-3.5" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5" />
          )}
          {marginPct === null ? "Margin —" : `Margin ${marginPct.toFixed(1)}%`}
          <span className="opacity-70"> · akrual</span>
        </div>
        <div className="ma-hero-pills">
          <div className="ma-hpill">
            <div className="l">
              <TrendingUp className="h-3.5 w-3.5" />
              Penjualan
            </div>
            <div className="v ma-num">
              {loading ? "…" : formatIDRShort(Number(summary?.total_sales ?? 0))}
            </div>
          </div>
          <div className="ma-hpill">
            <div className="l">
              <TrendingDown className="h-3.5 w-3.5" />
              Pengeluaran
            </div>
            <div className="v ma-num">{loading ? "…" : formatIDRShort(pengeluaran)}</div>
          </div>
        </div>
      </div>

      {/* Aksi cepat — Beli dulu, lalu Jual */}
      <div className="ma-qa-row">
        <Link href="/purchases" className="ma-qa">
          <span className="ma-qa-ic">
            <ShoppingCart className="h-[22px] w-[22px]" />
          </span>
          <span className="ma-qa-lbl">Beli</span>
        </Link>
        <Link href="/sales" className="ma-qa">
          <span className="ma-qa-ic">
            <ReceiptText className="h-[22px] w-[22px]" />
          </span>
          <span className="ma-qa-lbl">Jual</span>
        </Link>
        <Link href="/invoices" className="ma-qa amber">
          <span className="ma-qa-ic">
            <FileText className="h-[22px] w-[22px]" />
          </span>
          <span className="ma-qa-lbl">Invoice</span>
        </Link>
        <Link href="/menu" className="ma-qa">
          <span className="ma-qa-ic">
            <LayoutGrid className="h-[22px] w-[22px]" />
          </span>
          <span className="ma-qa-lbl">Lainnya</span>
        </Link>
      </div>

      {/* KPI: Piutang & Hutang */}
      <div className="ma-kpis">
        <div className="ma-card ma-kpi">
          <div className="l">
            <HandCoins className="h-3.5 w-3.5" />
            Piutang
          </div>
          <div className="v ma-num">{money(counts?.total_receivable)}</div>
          <div className="d">
            {counts ? `${counts.pending_invoices} invoice pending` : " "}
          </div>
        </div>
        <div className="ma-card ma-kpi">
          <div className="l">
            <ShoppingCart className="h-3.5 w-3.5" />
            Hutang
          </div>
          <div className="v ma-num">{money(counts?.total_payable)}</div>
          <div className="d">Ke distributor</div>
        </div>
      </div>

      {/* Tren laba */}
      <div className="ma-card ma-chartcard">
        <div className="ma-cc-top">
          <span className="ma-cc-l">Tren Laba (12 bulan)</span>
          <span className="ma-cc-v ma-num">
            {profitTrend.length
              ? formatIDRShort(profitTrend[profitTrend.length - 1].net)
              : "—"}
          </span>
        </div>
        <Sparkline points={profitTrend} />
        {profitTrend.length >= 2 && (
          <div className="ma-cc-x">
            <span>{shortMonth(profitTrend[0].month_start)}</span>
            <span>
              {shortMonth(profitTrend[Math.floor(profitTrend.length / 2)].month_start)}
            </span>
            <span>{shortMonth(profitTrend[profitTrend.length - 1].month_start)}</span>
          </div>
        )}
      </div>

      {/* Ringkasan periode */}
      <div>
        <div className="ma-sec">
          <h3>Ringkasan Periode</h3>
        </div>
        <ul className="ma-card ma-list">
          {summaryRows.map((r) => (
            <li key={r.label} className="ma-row">
              <span className={`ma-row-ic ${r.tone}`}>
                <r.icon className="h-[19px] w-[19px]" />
              </span>
              <span className="ma-row-main">
                <b>{r.label}</b>
              </span>
              <span className="ma-row-amt neg ma-num">{r.value}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Invoice tertunda */}
      <div>
        <div className="ma-sec">
          <h3>Invoice Tertunda</h3>
          <Link href="/invoices">
            Semua <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {pendingInvoices.length === 0 ? (
          <div className="ma-card p-4 text-center text-sm text-muted-foreground">
            Tidak ada invoice tertunda.
          </div>
        ) : (
          <ul className="ma-card ma-list">
            {pendingInvoices.map((inv) => (
              <Link key={inv.id} href="/invoices" className="ma-row">
                <span className="ma-row-ic amber">
                  <FileText className="h-[19px] w-[19px]" />
                </span>
                <span className="ma-row-main">
                  <b>{inv.company_name}</b>
                  <span>
                    {inv.invoice_no}
                    {inv.due_date && ` · tempo ${formatDate(inv.due_date)}`}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <span className="ma-row-amt neg ma-num">
                    {formatIDR(Number(inv.total))}
                  </span>
                  {inv.effective_status === "overdue" && (
                    <span className="ma-badge neg">Jatuh tempo</span>
                  )}
                </span>
              </Link>
            ))}
          </ul>
        )}
      </div>

      {/* Garansi akan habis */}
      <div>
        <div className="ma-sec">
          <h3>Garansi Akan Habis</h3>
          <Link href="/assets">
            Semua <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {expiringAssets.length === 0 ? (
          <div className="ma-card p-4 text-center text-sm text-muted-foreground">
            Tidak ada garansi mendekati habis.
          </div>
        ) : (
          <ul className="ma-card ma-list">
            {expiringAssets.map((a) => (
              <Link key={a.id} href="/assets" className="ma-row">
                <span className="ma-row-ic teal">
                  <ShieldAlert className="h-[19px] w-[19px]" />
                </span>
                <span className="ma-row-main">
                  <b>{a.product_name}</b>
                  <span>{a.company_name}</span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <span className="ma-badge amber">{a.days_left} hari</span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDate(a.warranty_end)}
                  </span>
                </span>
              </Link>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
