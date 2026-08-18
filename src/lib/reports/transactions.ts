import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TxRow } from "@/types/reports";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Susun seluruh baris Riwayat Transaksi dari berbagai sumber uang.
 *
 * Sumber yang ikut (disepakati 2026-08-02):
 *  - Penjualan, pembelian, pengeluaran operasional & pribadi.
 *  - Pelunasan invoice bulanan → nilainya NETTO (setelah PPh 23 dipotong
 *    client) supaya cocok dengan mutasi bank.
 *  - Termin & biaya proyek RAB, HANYA untuk proyek berstatus SELESAI.
 *
 * Dipakai bersama oleh halaman Riwayat Transaksi dan route export
 * agar isi layar dan file unduhan identik.
 */
export async function buildTransactionRows(
  supabase: SupabaseClient
): Promise<TxRow[]> {
  const [
    { data: sales }, { data: purchases }, { data: opEx }, { data: persEx },
    { data: paidInvoices }, { data: rabPayments }, { data: rabExpenses },
  ] = await Promise.all([
    supabase.from("sales")
      // wallet:wallets!wallet_id → tegaskan FK (sales punya 2 relasi ke wallets)
      // sale_items → keterangan diisi nama barang/jasa yang dijual
      .select("id, sale_date, total, payment_method, paid_date, wallet_id, notes, " +
        "client:clients(company_name), wallet:wallets!wallet_id(name), " +
        "invoice:monthly_invoices(status), " +
        "sale_items(qty, item_name, product:products(name))")
      .order("sale_date", { ascending: false }),
    supabase.from("purchases")
      // purchase_items → keterangan diisi nama barang yang dibeli
      .select("id, purchase_date, total, wallet_id, invoice_no, notes, " +
        "distributor:distributors(name), wallet:wallets(name), " +
        "purchase_items(qty, product:products(name))")
      .order("purchase_date", { ascending: false }),
    supabase.from("operational_expenses")
      .select("id, expense_date, amount, wallet_id, category_id, label_id, description, " +
        "category:categories(name), label:labels(name,color), wallet:wallets(name)")
      .order("expense_date", { ascending: false }),
    supabase.from("personal_expenses")
      .select("id, expense_date, amount, wallet_id, category_id, label_id, description, " +
        "category:categories(name), label:labels(name,color), wallet:wallets(name)")
      .order("expense_date", { ascending: false }),
    supabase.from("monthly_invoices")
      .select("id, invoice_no, paid_date, total, pph_amount, paid_wallet_id, " +
        "client:clients(company_name), wallet:wallets!paid_wallet_id(name)")
      .eq("status", "paid").order("paid_date", { ascending: false }),
    supabase.from("rab_payments")
      .select("id, payment_date, description, amount, wallet_id, " +
        "wallet:wallets(name), rab:rab_projects(project_name, status, " +
        "client:clients(company_name))")
      .order("payment_date", { ascending: false }),
    supabase.from("rab_items")
      .select("id, item_name, total, paid_date, paid_wallet_id, " +
        "wallet:wallets!paid_wallet_id(name), rab:rab_projects(project_name, status, " +
        "client:clients(company_name))")
      .eq("item_type", "expense").not("paid_wallet_id", "is", null),
  ]);

  const rows: TxRow[] = [];

  // Ringkas daftar item jadi satu baris keterangan: "Nama ×qty, Nama, ...".
  // Barang pakai nama produk; jasa pakai item_name. ×qty hanya bila qty > 1.
  const summarizeItems = (items: any[]): string =>
    (items ?? [])
      .map((it) => {
        const name = it.item_name ?? it.product?.name ?? "-";
        const qty = Number(it.qty ?? 0);
        return qty > 1 ? `${name} ×${qty}` : name;
      })
      .filter(Boolean)
      .join(", ");

  // ---- Penjualan ----
  for (const s of (sales ?? []) as any[]) {
    const method = s.payment_method as string;
    let piutang = false;
    if (method === "monthly_invoice") piutang = (s.invoice?.status ?? "") !== "paid";
    else if (method === "terhutang") piutang = !s.paid_date;
    const itemsDesc = summarizeItems(s.sale_items);
    rows.push({
      key: `sale-${s.id}`,
      source: "sale",
      direction: "in",
      date: s.sale_date,
      party: s.client?.company_name ?? "-",
      walletId: s.wallet_id ?? null,
      walletName: s.wallet?.name ?? (piutang ? "(belum diterima)" : "-"),
      categoryId: null,
      labelId: null,
      // Keterangan = nama barang/jasa; bila kosong, mundur ke catatan.
      description: itemsDesc || (s.notes ?? ""),
      amount: Number(s.total),
      isPiutang: piutang,
      // Penjualan via invoice bulanan tidak dijumlahkan di sini — uangnya
      // dihitung pada baris "Pelunasan invoice" agar tidak dobel.
      countInTotal: method !== "monthly_invoice",
    });
  }

  // ---- Pembelian ----
  for (const p of (purchases ?? []) as any[]) {
    const itemsDesc = summarizeItems(p.purchase_items);
    rows.push({
      key: `purchase-${p.id}`,
      source: "purchase",
      direction: "out",
      date: p.purchase_date,
      party: p.distributor?.name ?? "-",
      walletId: p.wallet_id ?? null,
      walletName: p.wallet?.name ?? "-",
      categoryId: null,
      labelId: null,
      // Keterangan = nama barang dibeli; bila kosong, mundur ke Nota/catatan.
      description: itemsDesc || (p.invoice_no ? `Nota ${p.invoice_no}` : (p.notes ?? "")),
      amount: Number(p.total),
      isPiutang: false,
    });
  }

  // ---- Pengeluaran operasional & pribadi ----
  const pushExpense = (list: any[], source: "op" | "personal") => {
    for (const e of list) {
      rows.push({
        key: `${source}-${e.id}`,
        source,
        direction: "out",
        date: e.expense_date,
        party: e.category?.name ?? "Tanpa kategori",
        walletId: e.wallet_id ?? null,
        walletName: e.wallet?.name ?? "-",
        categoryId: e.category_id ?? null,
        labelId: e.label_id ?? null,
        labelName: e.label?.name ?? null,
        labelColor: e.label?.color ?? null,
        description: e.description ?? "",
        amount: Number(e.amount),
        isPiutang: false,
      });
    }
  };
  pushExpense((opEx ?? []) as any[], "op");
  pushExpense((persEx ?? []) as any[], "personal");

  // ---- Pelunasan invoice bulanan (uang benar-benar diterima) ----
  for (const v of (paidInvoices ?? []) as any[]) {
    const pph = Number(v.pph_amount ?? 0);
    rows.push({
      key: `invoice-${v.id}`,
      source: "invoice",
      direction: "in",
      date: v.paid_date,
      party: v.client?.company_name ?? "-",
      walletId: v.paid_wallet_id ?? null,
      walletName: v.wallet?.name ?? "-",
      categoryId: null,
      labelId: null,
      description: pph > 0
        ? `Pelunasan ${v.invoice_no} — netto setelah PPh 23`
        : `Pelunasan ${v.invoice_no}`,
      amount: Number(v.total) - pph,
      isPiutang: false,
    });
  }

  // ---- Termin & biaya proyek RAB (hanya proyek SELESAI) ----
  for (const p of (rabPayments ?? []) as any[]) {
    if (p.rab?.status !== "done") continue;
    rows.push({
      key: `rabpay-${p.id}`,
      source: "rab_payment",
      direction: "in",
      date: p.payment_date,
      party: p.rab?.client?.company_name ?? "-",
      walletId: p.wallet_id ?? null,
      walletName: p.wallet?.name ?? "-",
      categoryId: null,
      labelId: null,
      description: `${p.rab?.project_name ?? "Proyek"} — ${p.description ?? "Termin"}`,
      amount: Number(p.amount),
      isPiutang: false,
    });
  }

  for (const e of (rabExpenses ?? []) as any[]) {
    if (e.rab?.status !== "done") continue;
    rows.push({
      key: `rabexp-${e.id}`,
      source: "rab_expense",
      direction: "out",
      date: e.paid_date,
      party: e.rab?.client?.company_name ?? "-",
      walletId: e.paid_wallet_id ?? null,
      walletName: e.wallet?.name ?? "-",
      categoryId: null,
      labelId: null,
      description: `${e.rab?.project_name ?? "Proyek"} — ${e.item_name}`,
      amount: Number(e.total),
      isPiutang: false,
    });
  }

  return rows;
}
