import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { moneyFmt, styleTitle, styleTableHeader, styleTotal, xlsxResponse } from "@/lib/reports/export-helpers";
import { rabCategoryRecap, RAB_UNCATEGORIZED } from "@/lib/rab/category-recap";
import type { RabItem, RabPayment, RabProject } from "@/types/phase7";
import { RAB_STATUS_LABELS, type RabStatus } from "@/types/phase7";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEAL = "FF0F766E";
const AMBER = "FFB45309";

// Judul bagian dengan latar berwarna, memenuhi lebar tabel (kolom 1..span).
function sectionRow(ws: ExcelJS.Worksheet, label: string, span: number, argb: string) {
  ws.addRow([]);
  const r = ws.addRow([label]);
  r.font = { bold: true, color: { argb: "FFFFFFFF" } };
  for (let i = 1; i <= span; i++) {
    const cell = r.getCell(i);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  }
  return r;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: project } = await supabase
    .from("v_rab_summary").select("*").eq("id", id).single();
  if (!project) return new NextResponse("RAB tidak ditemukan", { status: 404 });

  const [{ data: items }, { data: payments }, { data: wallets }, { data: categories }] = await Promise.all([
    supabase.from("rab_items").select("*").eq("rab_id", id).order("sort_order"),
    supabase.from("rab_payments").select("*").eq("rab_id", id).order("payment_date"),
    supabase.from("wallets").select("id, name"),
    supabase.from("categories").select("id, name").eq("type", "rab_expense"),
  ]);

  const walletNames: Record<string, string> = {};
  for (const w of (wallets ?? []) as { id: string; name: string }[]) walletNames[w.id] = w.name;
  const categoryNames: Record<string, string> = {};
  for (const c of (categories ?? []) as { id: string; name: string }[]) categoryNames[c.id] = c.name;

  const proj = project as RabProject;
  const all = (items ?? []) as RabItem[];
  const budget = all.filter((i) => i.item_type === "budget");
  const expense = all.filter((i) => i.item_type === "expense");
  const pays = (payments ?? []) as RabPayment[];

  const catLabel = (it: RabItem) =>
    it.category_id ? (categoryNames[it.category_id] ?? RAB_UNCATEGORIZED) : RAB_UNCATEGORIZED;

  const recap = rabCategoryRecap(
    expense.map((e) => ({ category_id: e.category_id, amount: Number(e.total) })),
    categoryNames
  );

  const st = (proj.status ?? "draft") as RabStatus;

  // ============ WORKBOOK ============
  const wb = new ExcelJS.Workbook();
  wb.creator = "Athaya Computer — PBMS-IT";
  wb.created = new Date();
  const ws = wb.addWorksheet("RAB");

  // Kolom (konsisten sepanjang sheet):
  // 1 No · 2 Nama · 3 Kategori · 4 Qty · 5 Harga · 6 Total/Nominal · 7 Tanggal · 8 Wallet
  ws.columns = [
    { width: 5 }, { width: 34 }, { width: 16 }, { width: 8 },
    { width: 16 }, { width: 16 }, { width: 13 }, { width: 22 },
  ];

  styleTitle(
    ws,
    `RAB — ${proj.project_name}`,
    `Client: ${proj.company_name ?? "-"} · Status: ${RAB_STATUS_LABELS[st]} · Tanggal: ${proj.project_date}`
  );

  // ---------- 1. DETAIL RAB (PENAWARAN) ----------
  sectionRow(ws, "1. DETAIL RAB (PENAWARAN)", 6, TEAL);
  const bHead = ws.addRow(["No", "Nama Barang", "", "Qty", "Harga", "Total"]);
  styleTableHeader(bHead);
  const bFirst = ws.rowCount + 1;
  budget.forEach((it, i) => {
    const row = ws.addRow([i + 1, it.item_name, "", Number(it.qty), Number(it.price), null]);
    row.getCell(6).value = { formula: `D${row.number}*E${row.number}` };
  });
  const bLast = ws.rowCount;
  const hasBudget = bLast >= bFirst;
  const bTotal = ws.addRow([
    "", "Grand Total RAB (Nilai Proyek)", "", "", "",
    hasBudget ? { formula: `SUM(F${bFirst}:F${bLast})` } : 0,
  ]);
  styleTotal(bTotal);
  const grandRabCell = `F${bTotal.number}`;

  // ---------- 2. DETAIL PENGELUARAN (REALISASI) ----------
  sectionRow(ws, "2. DETAIL PENGELUARAN (REALISASI)", 8, AMBER);
  const eHead = ws.addRow(["No", "Nama Barang / Jasa", "Kategori", "Qty", "Harga", "Total", "Tanggal", "Wallet"]);
  styleTableHeader(eHead);
  const eFirst = ws.rowCount + 1;
  expense.forEach((it, i) => {
    const row = ws.addRow([
      i + 1, it.item_name, catLabel(it), Number(it.qty), Number(it.price), null,
      it.paid_date ?? "", it.paid_wallet_id ? (walletNames[it.paid_wallet_id] ?? "") : "Belum dibayar",
    ]);
    row.getCell(6).value = { formula: `D${row.number}*E${row.number}` };
  });
  const eLast = ws.rowCount;
  const hasExpense = eLast >= eFirst;
  const eTotal = ws.addRow([
    "", "Grand Total Pengeluaran", "", "", "",
    hasExpense ? { formula: `SUM(F${eFirst}:F${eLast})` } : 0, "", "",
  ]);
  styleTotal(eTotal);
  const grandExpenseCell = `F${eTotal.number}`;

  // ---------- REKAP PER KATEGORI (SUMIF → ikut berubah saat diedit) ----------
  if (recap.length > 0) {
    sectionRow(ws, "REKAP PER KATEGORI (terbesar → terkecil)", 6, AMBER);
    const rHead = ws.addRow(["", "Kategori", "", "", "Total", "% dari total"]);
    styleTableHeader(rHead);
    for (const row of recap) {
      const name = row.name.replace(/"/g, '""');
      const r = ws.addRow(["", row.name, "", "", null, null]);
      // Total kategori = SUMIF atas kolom Kategori (C) & Total (F) tabel pengeluaran.
      r.getCell(5).value = hasExpense
        ? { formula: `SUMIF(C${eFirst}:C${eLast},"${name}",F${eFirst}:F${eLast})` }
        : row.total;
      r.getCell(6).value = { formula: `IFERROR(E${r.number}/${grandExpenseCell},0)` };
      r.getCell(6).numFmt = "0.0%";
    }
  }

  // ---------- 3. TERMIN PEMBAYARAN ----------
  sectionRow(ws, "3. TERMIN PEMBAYARAN", 8, TEAL);
  const pHead = ws.addRow(["No", "Keterangan", "", "", "", "Nominal", "Tanggal", "Wallet"]);
  styleTableHeader(pHead);
  const pFirst = ws.rowCount + 1;
  pays.forEach((p, i) => {
    ws.addRow([
      i + 1, p.description, "", "", "", Number(p.amount),
      p.payment_date ?? "", walletNames[p.wallet_id] ?? "",
    ]);
  });
  const pLast = ws.rowCount;
  const hasPay = pLast >= pFirst;
  const pTotal = ws.addRow([
    "", "Total Diterima", "", "", "",
    hasPay ? { formula: `SUM(F${pFirst}:F${pLast})` } : 0, "", "",
  ]);
  styleTotal(pTotal);
  const totalPaidCell = `F${pTotal.number}`;

  // ---------- RINGKASAN ----------
  sectionRow(ws, "RINGKASAN", 6, TEAL);
  const labaRow = ws.addRow(["", "Laba Proyek (Nilai − Pengeluaran)", "", "", "", null]);
  labaRow.getCell(6).value = { formula: `${grandRabCell}-${grandExpenseCell}` };
  labaRow.font = { bold: true };
  const sisaRow = ws.addRow(["", "Sisa Tagihan (Nilai − Diterima)", "", "", "", null]);
  sisaRow.getCell(6).value = { formula: `MAX(${grandRabCell}-${totalPaidCell},0)` };

  // Format mata uang untuk kolom Harga (5) & Total/Nominal (6).
  ws.getColumn(5).numFmt = moneyFmt;
  ws.getColumn(6).numFmt = moneyFmt;

  ws.addRow([]);
  const note = ws.addRow([
    "Catatan: kolom Total & Grand Total memakai rumus — ubah Qty/Harga maka totalnya ikut berubah. " +
    "Rekap per kategori memakai SUMIF terhadap kolom Kategori pengeluaran.",
  ]);
  note.font = { italic: true, size: 9, color: { argb: "FF6B7280" } };

  const safeName = (proj.project_name ?? "RAB").replace(/[^a-z0-9]/gi, "-");
  return xlsxResponse(await wb.xlsx.writeBuffer(), `RAB-${safeName}.xlsx`);
}
