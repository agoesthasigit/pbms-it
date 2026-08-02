import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { createClient } from "@/lib/supabase/server";
import { buildProfitLoss } from "@/lib/reports/profit-loss";
import { ProfitLossPdf } from "./profit-loss-pdf";
import {
  resolvePeriod, moneyFmt, styleTitle, styleSection, styleTotal, xlsxResponse,
} from "@/lib/reports/export-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const { from, to } = resolvePeriod(url);
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "excel";

  try {
    const data = await buildProfitLoss(supabase, from, to);

    // ---------------- PDF ----------------
    if (format === "pdf") {
      const buffer = await renderToBuffer(
        createElement(ProfitLossPdf, { data }) as ReactElement<DocumentProps>
      );
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="Laba-Rugi-${from}_${to}.pdf"`,
        },
      });
    }

    // ---------------- EXCEL ----------------
    const wb = new ExcelJS.Workbook();
    wb.creator = "Athaya Computer — PBMS-IT";
    wb.created = new Date();

    const ws = wb.addWorksheet("Laba Rugi");
    ws.columns = [{ width: 46 }, { width: 20 }, { width: 34 }];

    styleTitle(ws, "LAPORAN LABA RUGI", `Periode ${from} s/d ${to}`);

    // ---- A. Pendapatan usaha ----
    styleSection(ws, "A. PENDAPATAN USAHA");
    const revStart = ws.rowCount + 1;
    for (const r of data.revenue) ws.addRow([r.name, r.amount]);
    const revEnd = ws.rowCount;
    const revTotalRow = ws.addRow([
      "Total Pendapatan Usaha",
      data.revenue.length ? { formula: `SUM(B${revStart}:B${revEnd})` } : 0,
    ]);
    styleTotal(revTotalRow);
    const revRef = `B${revTotalRow.number}`;

    // ---- B. HPP ----
    styleSection(ws, "B. HARGA POKOK PENJUALAN (HPP)");
    const cogsStart = ws.rowCount + 1;
    for (const r of data.cogs) ws.addRow([r.name, r.amount]);
    const cogsEnd = ws.rowCount;
    const cogsTotalRow = ws.addRow([
      "Total HPP",
      data.cogs.length ? { formula: `SUM(B${cogsStart}:B${cogsEnd})` } : 0,
    ]);
    styleTotal(cogsTotalRow);
    const cogsRef = `B${cogsTotalRow.number}`;

    ws.addRow([]);
    const grossRow = ws.addRow(["LABA KOTOR", { formula: `${revRef}-${cogsRef}` }]);
    styleTotal(grossRow);
    const grossRef = `B${grossRow.number}`;
    const marginRow = ws.addRow([
      "Margin Kotor",
      { formula: `IFERROR(${grossRef}/${revRef},0)` },
    ]);
    marginRow.getCell(2).numFmt = "0.0%";
    marginRow.font = { bold: true };

    // ---- C. Biaya operasional ----
    styleSection(ws, "C. BIAYA OPERASIONAL");
    const opStart = ws.rowCount + 1;
    for (const r of data.opex) ws.addRow([r.name, r.amount]);
    if (data.personal_total > 0) ws.addRow(["Pengeluaran Pribadi", data.personal_total]);
    if (data.pph_total > 0) {
      ws.addRow(["Pajak PPh 23 (dipotong client atas jasa)", data.pph_total]);
    }
    const opEnd = ws.rowCount;
    const hasOpex = opEnd >= opStart;
    const opTotalRow = ws.addRow([
      "Total Biaya Operasional",
      hasOpex ? { formula: `SUM(B${opStart}:B${opEnd})` } : 0,
    ]);
    styleTotal(opTotalRow);
    const opRef = `B${opTotalRow.number}`;

    ws.addRow([]);
    const netRow = ws.addRow(["LABA BERSIH", { formula: `${grossRef}-${opRef}` }]);
    netRow.font = { bold: true, size: 13 };
    netRow.getCell(2).numFmt = moneyFmt;
    netRow.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFECFDF5" } };
    });

    // ---- D. Proyek berjalan ----
    styleSection(ws, "D. PROYEK BERJALAN — BELUM DIAKUI SEBAGAI LABA");
    if (data.ongoing.length === 0) {
      ws.addRow(["Tidak ada proyek yang masih berjalan."]);
    } else {
      for (const p of data.ongoing) {
        const head = ws.addRow([`${p.project_name} — ${p.company_name}`, "", "BERJALAN"]);
        head.font = { bold: true };
        head.getCell(3).font = { bold: true, color: { argb: "FFB45309" } };
        ws.addRow(["   Uang muka diterima", p.received]);
        ws.addRow(["   Biaya proyek dikeluarkan", -p.spent]);
        const sisa = ws.addRow([
          "   Sisa uang muka (kewajiban ke client)",
          { formula: `SUM(B${ws.rowCount - 1}:B${ws.rowCount})` },
        ]);
        sisa.font = { bold: true };
        sisa.getCell(3).value = "Uang client, bukan laba";
      }
    }

    // ---- E. Persediaan ----
    styleSection(ws, "E. PERSEDIAAN — ASET, BELUM JADI BIAYA");
    const invStart = ws.rowCount + 1;
    for (const r of data.inventory) {
      ws.addRow([`${r.name} (${r.qty} ${r.unit})`, r.value]);
    }
    const invEnd = ws.rowCount;
    const invTotalRow = ws.addRow([
      "Total Nilai Persediaan",
      data.inventory.length ? { formula: `SUM(B${invStart}:B${invEnd})` } : 0,
    ]);
    styleTotal(invTotalRow);
    invTotalRow.getCell(3).value = "Jadi HPP saat barang terjual";

    // Format kolom nominal + catatan penjelas
    ws.getColumn(2).numFmt = moneyFmt;
    ws.getColumn(3).font = { italic: true, color: { argb: "FF6B7280" } };

    ws.addRow([]);
    const note = ws.addRow([
      "Catatan: HPP memakai modal barang yang benar-benar terjual — barang yang " +
      "dibeli tapi belum terjual tetap menjadi persediaan (bagian E), belum jadi biaya.",
    ]);
    note.font = { italic: true, size: 9, color: { argb: "FF6B7280" } };

    return xlsxResponse(await wb.xlsx.writeBuffer(), `Laba-Rugi-${from}_${to}.xlsx`);
  } catch (err) {
    console.error("Export laba rugi error:", err);
    return NextResponse.json({ error: "Gagal membuat laporan" }, { status: 500 });
  }
}
