"use server";

import { createClient } from "@/lib/supabase/server";
import { buildProfitLoss } from "@/lib/reports/profit-loss";
import { buildMarginReport } from "@/lib/reports/margin";
import type { ProfitLoss, MarginReport, ProfitTrendPoint } from "@/types/reports";

export async function getProfitLoss(from: string, to: string): Promise<ProfitLoss> {
  const supabase = await createClient();
  return buildProfitLoss(supabase, from, to);
}

/**
 * Tren laba **akrual** untuk `months` bulan terakhir (termasuk bulan berjalan).
 * Menghitung `buildProfitLoss` per bulan → sumber angka SAMA dengan Laporan
 * Laba Rugi, jadi garis "Laba" di Dashboard tidak lagi memakai `finance_summary`
 * (metode kas) yang bisa berbeda dari kenyataan.
 */
export async function getProfitLossTrend(months: number): Promise<ProfitTrendPoint[]> {
  const supabase = await createClient();
  const pad = (x: number) => String(x).padStart(2, "0");
  const now = new Date();

  // Susun rentang tiap bulan (awal → akhir bulan) memakai komponen tanggal lokal
  // (bukan toISOString yang UTC) agar tak bergeser sehari di zona WIB.
  const ranges = Array.from({ length: months }, (_, i) => {
    const dt = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    const y = dt.getFullYear();
    const m = dt.getMonth() + 1;
    const lastDay = new Date(y, m, 0).getDate();
    return {
      month_start: `${y}-${pad(m)}-01`,
      from: `${y}-${pad(m)}-01`,
      to: `${y}-${pad(m)}-${pad(lastDay)}`,
    };
  });

  const results = await Promise.all(
    ranges.map((r) => buildProfitLoss(supabase, r.from, r.to))
  );

  return ranges.map((r, i) => {
    const pl = results[i];
    return {
      month_start: r.month_start,
      revenue: pl.revenue_total,
      expense: pl.cogs_total + pl.opex_total,
      net: pl.net_profit,
    };
  });
}

export async function getMarginReport(from: string, to: string): Promise<MarginReport> {
  const supabase = await createClient();
  return buildMarginReport(supabase, from, to);
}
