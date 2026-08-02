import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MarginReport, MarginRow } from "@/types/reports";

/* eslint-disable @typescript-eslint/no-explicit-any */

const n = (v: unknown) => Number(v ?? 0);

/**
 * Susun Analisa Margin per item untuk satu periode.
 *
 * Sumber baris:
 *  - Item penjualan (sale_items): harga jual vs modal (cost_price).
 *    Baris JASA modalnya 0 → margin 100%, sama seperti di Excel.
 *  - Proyek RAB dengan status SELESAI saja (permintaan user 2026-08-02);
 *    proyek yang masih berjalan tidak ditampilkan karena angkanya belum final.
 */
export async function buildMarginReport(
  supabase: SupabaseClient,
  from: string,
  to: string
): Promise<MarginReport> {
  const [salesRes, rabRes] = await Promise.all([
    supabase.from("sales")
      .select("id, sale_date, client:clients(company_name), " +
        "sale_items(qty, price, cost_price, subtotal, item_name, product:products(name))")
      .gte("sale_date", from).lte("sale_date", to)
      .order("sale_date"),
    supabase.from("v_rab_summary").select("*").eq("status", "done"),
  ]);

  const rows: MarginRow[] = [];

  for (const s of (salesRes.data ?? []) as any[]) {
    const group = s.client?.company_name ?? "Tanpa client";
    for (const it of (s.sale_items ?? []) as any[]) {
      const qty = n(it.qty);
      const revenue = n(it.subtotal);
      const cost = n(it.cost_price) * qty;
      const margin = revenue - cost;
      rows.push({
        group,
        // Baris jasa memakai nama bebas (item_name); barang memakai nama produk.
        item: it.item_name ?? it.product?.name ?? "-",
        qty, cost, revenue, margin,
        margin_pct: revenue > 0 ? margin / revenue : 0,
        kind: "sale",
      });
    }
  }

  for (const r of ((rabRes.data ?? []) as any[])
    .filter((r) => r.project_date >= from && r.project_date <= to)) {
    const revenue = n(r.grand_total_rab);
    const cost = n(r.grand_total_expense);
    const margin = revenue - cost;
    rows.push({
      group: `Proyek — ${r.company_name ?? "-"}`,
      item: r.project_name,
      qty: 1, cost, revenue, margin,
      margin_pct: revenue > 0 ? margin / revenue : 0,
      kind: "project",
    });
  }

  rows.sort((a, b) =>
    a.group.localeCompare(b.group) || a.item.localeCompare(b.item));

  const total_cost = rows.reduce((s, r) => s + r.cost, 0);
  const total_revenue = rows.reduce((s, r) => s + r.revenue, 0);
  const total_margin = total_revenue - total_cost;

  return {
    period: { from, to },
    rows,
    total_cost, total_revenue, total_margin,
    total_margin_pct: total_revenue > 0 ? total_margin / total_revenue : 0,
  };
}
