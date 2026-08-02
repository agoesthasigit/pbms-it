import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ProfitLoss, PlLine, OngoingProject, InventoryLine,
} from "@/types/reports";

/* eslint-disable @typescript-eslint/no-explicit-any */

const n = (v: unknown) => Number(v ?? 0);

/** Jumlahkan ke dalam Map lalu keluarkan terurut dari besar ke kecil. */
function grouped(map: Map<string, number>): PlLine[] {
  return [...map.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .filter((r) => r.amount !== 0)
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Susun Laporan Laba Rugi untuk satu periode.
 *
 * Prinsip yang dipakai (disepakati 2026-08-02):
 *  - Pendapatan diakui dari PENJUALAN pada periode + PROYEK yang sudah SELESAI.
 *  - HPP memakai modal barang yang BENAR-BENAR TERJUAL (sale_items.cost_price),
 *    bukan total pembelian. Barang yang dibeli tapi belum terjual tetap jadi
 *    PERSEDIAAN (bagian E), belum jadi biaya.
 *  - Proyek yang masih BERJALAN dipisah ke bagian D dan labanya TIDAK diakui.
 *  - PPh 23 yang dipotong client dicatat sebagai BIAYA bertanda "Pajak PPh 23".
 *
 * Dipakai bersama oleh halaman Laporan Keuangan, export Excel, dan export PDF
 * agar angkanya selalu identik.
 */
export async function buildProfitLoss(
  supabase: SupabaseClient,
  from: string,
  to: string
): Promise<ProfitLoss> {
  const [
    salesRes, rabRes, opRes, persRes, invRes, stockRes, rabPayRes,
  ] = await Promise.all([
    supabase.from("sales")
      .select("id, sale_date, total, client:clients(company_name), " +
        "sale_items(qty, price, cost_price, subtotal, item_name, product:products(name, is_service))")
      .gte("sale_date", from).lte("sale_date", to),
    supabase.from("v_rab_summary").select("*"),
    supabase.from("operational_expenses")
      .select("amount, category:categories(name)")
      .gte("expense_date", from).lte("expense_date", to),
    supabase.from("personal_expenses")
      .select("amount, category:categories(name)")
      .gte("expense_date", from).lte("expense_date", to),
    supabase.from("monthly_invoices")
      .select("pph_amount")
      .gte("paid_date", from).lte("paid_date", to),
    supabase.from("v_product_stock").select("name, unit, current_stock, last_purchase_price"),
    supabase.from("rab_payments").select("rab_id, amount"),
  ]);

  // ---------- A. Pendapatan usaha ----------
  const revMap = new Map<string, number>();
  let cogsGoods = 0;

  for (const s of (salesRes.data ?? []) as any[]) {
    const client = s.client?.company_name ?? "Tanpa client";
    revMap.set(client, (revMap.get(client) ?? 0) + n(s.total));
    for (const it of (s.sale_items ?? []) as any[]) {
      // Baris jasa modalnya 0 — tidak menambah HPP.
      cogsGoods += n(it.cost_price) * n(it.qty);
    }
  }

  // Proyek yang SUDAH selesai: nilai proyek diakui sebagai pendapatan,
  // biaya proyeknya masuk HPP. Proyek berjalan tidak disentuh di sini.
  const allRab = (rabRes.data ?? []) as any[];
  const doneRab = allRab.filter(
    (r) => r.status === "done" && r.project_date >= from && r.project_date <= to
  );
  let cogsProject = 0;
  for (const r of doneRab) {
    const label = `Proyek: ${r.project_name}`;
    revMap.set(label, (revMap.get(label) ?? 0) + n(r.grand_total_rab));
    cogsProject += n(r.grand_total_expense);
  }

  const revenue = grouped(revMap);
  const revenue_total = revenue.reduce((s, r) => s + r.amount, 0);

  // ---------- B. Harga pokok penjualan ----------
  const cogs: PlLine[] = [];
  if (cogsGoods !== 0) cogs.push({ name: "Modal barang terjual", amount: cogsGoods });
  if (cogsProject !== 0) cogs.push({ name: "Biaya proyek selesai", amount: cogsProject });
  const cogs_total = cogsGoods + cogsProject;

  const gross_profit = revenue_total - cogs_total;
  const gross_margin = revenue_total > 0 ? gross_profit / revenue_total : 0;

  // ---------- C. Biaya operasional ----------
  const opMap = new Map<string, number>();
  for (const e of (opRes.data ?? []) as any[]) {
    const name = e.category?.name ?? "Tanpa kategori";
    opMap.set(name, (opMap.get(name) ?? 0) + n(e.amount));
  }
  const opex = grouped(opMap);

  const personal_total = ((persRes.data ?? []) as any[])
    .reduce((s, e) => s + n(e.amount), 0);

  const pph_total = ((invRes.data ?? []) as any[])
    .reduce((s, i) => s + n(i.pph_amount), 0);

  const opex_total =
    opex.reduce((s, r) => s + r.amount, 0) + personal_total + pph_total;

  const net_profit = gross_profit - opex_total;

  // ---------- D. Proyek berjalan (belum diakui) ----------
  const paidByRab = new Map<string, number>();
  for (const p of (rabPayRes.data ?? []) as any[]) {
    paidByRab.set(p.rab_id, (paidByRab.get(p.rab_id) ?? 0) + n(p.amount));
  }
  const ongoing: OngoingProject[] = allRab
    .filter((r) => r.status !== "done" && r.project_date <= to)
    .map((r) => {
      const received = paidByRab.get(r.id) ?? 0;
      const spent = n(r.grand_total_expense);
      return {
        id: r.id,
        project_name: r.project_name,
        company_name: r.company_name ?? "-",
        status: r.status,
        received,
        spent,
        remaining: received - spent,
      };
    })
    .sort((a, b) => a.project_name.localeCompare(b.project_name));

  const ongoing_received = ongoing.reduce((s, r) => s + r.received, 0);
  const ongoing_spent = ongoing.reduce((s, r) => s + r.spent, 0);
  const ongoing_remaining = ongoing_received - ongoing_spent;

  // ---------- E. Persediaan (nilai stok saat ini) ----------
  const inventory: InventoryLine[] = ((stockRes.data ?? []) as any[])
    .filter((p) => n(p.current_stock) > 0)
    .map((p) => ({
      name: p.name,
      qty: n(p.current_stock),
      unit: p.unit ?? "pcs",
      value: n(p.current_stock) * n(p.last_purchase_price),
    }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
  const inventory_total = inventory.reduce((s, r) => s + r.value, 0);

  return {
    period: { from, to },
    revenue, revenue_total,
    cogs, cogs_total,
    gross_profit, gross_margin,
    opex, personal_total, pph_total, opex_total,
    net_profit,
    ongoing, ongoing_received, ongoing_spent, ongoing_remaining,
    inventory, inventory_total,
  };
}
