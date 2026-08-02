"use client";

import { AlertTriangle, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatIDR } from "@/lib/utils/currency";
import { ReportDownload } from "@/components/shared/report-download";
import type { ProfitLoss } from "@/types/reports";

/** Baris biasa laporan — ukuran font sama untuk semua bagian. */
function Row({
  label, value, muted = false, bold = false, indent = false,
}: {
  label: string; value: number; muted?: boolean; bold?: boolean; indent?: boolean;
}) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-1 ${indent ? "pl-4" : ""}`}>
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span className={`shrink-0 tabular-nums ${bold ? "font-semibold" : ""}`}>
        {formatIDR(value)}
      </span>
    </div>
  );
}

/** Judul bagian A/B/C/D/E — sengaja disamakan ukurannya agar terbaca jelas. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-5 border-b pb-1.5 text-sm font-bold uppercase tracking-wide first:mt-0">
      {children}
    </h3>
  );
}

export function ProfitLossView({
  data, loading,
}: {
  data: ProfitLoss | null;
  loading: boolean;
}) {
  if (loading || !data) {
    return (
      <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
        Menghitung laporan…
      </CardContent></Card>
    );
  }

  const hasOngoing = data.ongoing.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Periode {data.period.from} s/d {data.period.to}
        </p>
        <ReportDownload href="/api/reports/profit-loss"
          from={data.period.from} to={data.period.to} label="Unduh Laba Rugi" />
      </div>

      <Card>
        <CardContent className="py-5 text-sm">
          {/* ---------- A. PENDAPATAN USAHA ---------- */}
          <SectionTitle>A. Pendapatan Usaha</SectionTitle>
          {data.revenue.length === 0 ? (
            <p className="py-2 text-muted-foreground">Tidak ada pendapatan pada periode ini.</p>
          ) : (
            data.revenue.map((r) => <Row key={r.name} label={r.name} value={r.amount} indent />)
          )}
          <div className="mt-1 border-t pt-1">
            <Row label="Total Pendapatan Usaha" value={data.revenue_total} bold />
          </div>

          {/* ---------- B. HPP ---------- */}
          <SectionTitle>B. Harga Pokok Penjualan (HPP)</SectionTitle>
          {data.cogs.length === 0 ? (
            <p className="py-2 text-muted-foreground">Tidak ada modal terpakai pada periode ini.</p>
          ) : (
            data.cogs.map((r) => <Row key={r.name} label={r.name} value={r.amount} indent />)
          )}
          <div className="mt-1 border-t pt-1">
            <Row label="Total HPP" value={data.cogs_total} bold />
          </div>

          <div className="mt-3 rounded-lg bg-muted px-3 py-2">
            <Row label="LABA KOTOR" value={data.gross_profit} bold />
            <div className="flex items-baseline justify-between gap-4 py-1">
              <span className="text-muted-foreground">Margin Kotor</span>
              <span className="shrink-0 font-semibold tabular-nums">
                {(data.gross_margin * 100).toFixed(1)}%
              </span>
            </div>
          </div>

          {/* ---------- C. BIAYA OPERASIONAL ---------- */}
          <SectionTitle>C. Biaya Operasional</SectionTitle>
          {data.opex.map((r) => <Row key={r.name} label={r.name} value={r.amount} indent />)}
          {data.personal_total > 0 && (
            <Row label="Pengeluaran Pribadi" value={data.personal_total} indent />
          )}
          {data.pph_total > 0 && (
            <Row label="Pajak PPh 23 (dipotong client atas jasa)"
              value={data.pph_total} indent />
          )}
          {data.opex_total === 0 && (
            <p className="py-2 text-muted-foreground">Tidak ada biaya pada periode ini.</p>
          )}
          <div className="mt-1 border-t pt-1">
            <Row label="Total Biaya Operasional" value={data.opex_total} bold />
          </div>

          {/* ---------- LABA BERSIH ---------- */}
          <div className={`mt-4 flex items-baseline justify-between gap-4 rounded-lg px-4 py-3 ${
            data.net_profit >= 0
              ? "bg-emerald-50 dark:bg-emerald-500/10"
              : "bg-destructive/10"
          }`}>
            <span className="text-base font-bold uppercase tracking-wide">Laba Bersih</span>
            <span className={`shrink-0 text-2xl font-bold tabular-nums ${
              data.net_profit >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-destructive"
            }`}>
              {formatIDR(data.net_profit)}
            </span>
          </div>

          {/* ---------- D. PROYEK BERJALAN ---------- */}
          <SectionTitle>D. Proyek Berjalan — belum diakui sebagai laba</SectionTitle>
          {!hasOngoing ? (
            <p className="py-2 text-muted-foreground">
              Tidak ada proyek yang masih berjalan.
            </p>
          ) : (
            <>
              {data.ongoing.map((p) => (
                <div key={p.id} className="border-b py-2 last:border-b-0">
                  <div className="flex items-center gap-2 pb-1">
                    <span className="font-medium">{p.project_name}</span>
                    <Badge variant="outline"
                      className="gap-1 border-amber-300 text-amber-700 dark:border-amber-500/40 dark:text-amber-400">
                      <AlertTriangle className="h-3 w-3" /> BERJALAN
                    </Badge>
                    <span className="text-muted-foreground">· {p.company_name}</span>
                  </div>
                  <Row label="Uang muka diterima" value={p.received} indent muted />
                  <Row label="Biaya proyek dikeluarkan" value={-p.spent} indent muted />
                  <Row label="Sisa uang muka (kewajiban ke client)"
                    value={p.remaining} indent bold />
                </div>
              ))}
              <p className="pt-2 text-xs text-muted-foreground">
                Sisa uang muka masih <b>uang client</b>, bukan laba. Angka di atas
                tidak dihitung dalam Laba Bersih.
              </p>
            </>
          )}

          {/* ---------- E. PERSEDIAAN ---------- */}
          <SectionTitle>E. Persediaan — aset, belum jadi biaya</SectionTitle>
          {data.inventory.length === 0 ? (
            <p className="py-2 text-muted-foreground">Tidak ada stok barang tersisa.</p>
          ) : (
            <>
              {data.inventory.slice(0, 15).map((r) => (
                <div key={r.name} className="flex items-baseline justify-between gap-4 py-1 pl-4">
                  <span className="min-w-0 truncate">
                    {r.name} <span className="text-muted-foreground">· {r.qty} {r.unit}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">{formatIDR(r.value)}</span>
                </div>
              ))}
              {data.inventory.length > 15 && (
                <p className="pl-4 text-xs text-muted-foreground">
                  +{data.inventory.length - 15} barang lain (lihat file unduhan untuk rincian penuh).
                </p>
              )}
              <div className="mt-1 border-t pt-1">
                <Row label="Total Nilai Persediaan" value={data.inventory_total} bold />
              </div>
              <p className="flex items-center gap-1.5 pt-2 text-xs text-muted-foreground">
                <Package className="h-3 w-3" />
                Nilai stok saat ini. Baru menjadi HPP ketika barang terjual.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
