"use server";

import { createClient } from "@/lib/supabase/server";
import { buildProfitLoss } from "@/lib/reports/profit-loss";
import { buildMarginReport } from "@/lib/reports/margin";
import type { ProfitLoss, MarginReport } from "@/types/reports";

export async function getProfitLoss(from: string, to: string): Promise<ProfitLoss> {
  const supabase = await createClient();
  return buildProfitLoss(supabase, from, to);
}

export async function getMarginReport(from: string, to: string): Promise<MarginReport> {
  const supabase = await createClient();
  return buildMarginReport(supabase, from, to);
}
