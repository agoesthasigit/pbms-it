import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { createClient } from "@/lib/supabase/server";
import { buildMarginReport } from "@/lib/reports/margin";
import { MarginPdf } from "./margin-pdf";
import {
  resolvePeriod, moneyFmt, styleTitle, styleTableHeader, styleTotal, xlsxResponse,
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
    const data = await buildMarginReport(supabase, from, to);

    // ---------------- PDF ----------------
    if (format === "pdf") {
      const buffer = await renderToBuffer(
        createElement(MarginPdf, { data }) as ReactElement<DocumentProps>
      );
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="Analisa-Margin-${from}_${to}.pdf"`,
        },
      });
    }

    // ---------------- EXCEL ----------------
    const wb = new ExcelJS.Workbook();
    wb.creator = "Athaya Computer — PBMS-IT";
    wb.created = new Date();

    const ws = wb.addWorksheet("Analisa Margin");
    ws.columns = [
      { width: 28 }, { width: 34 }, { width: 8 },
      { width: 18 }, { width: 18 }, { width: 18 }, { width: 12 },
    ];

    styleTitle(ws, "ANALISA MARGIN PER ITEM", `Periode ${from} s/d ${to}`);

    const header = ws.addRow([
      "Client / Proyek", "Item", "Qty",
      "Harga Beli", "Harga Jual", "Margin", "Margin %",
    ]);
    styleTableHeader(header);
    ws.views = [{ state: "frozen", ySplit: header.number }];

    const first = ws.rowCount + 1;
    for (const r of data.rows) {
      const row = ws.addRow([
        r.group,
        r.kind === "project" ? `${r.item} (proyek selesai)` : r.item,
        r.qty, r.cost, r.revenue, null, null,
      ]);
      // Margin & persentase memakai RUMUS agar sheet tetap hidup saat diedit.
      row.getCell(6).value = { formula: `E${row.number}-D${row.number}` };
      row.getCell(7).value = { formula: `IFERROR(F${row.number}/E${row.number},0)` };
    }
    const last = ws.rowCount;
    const hasRows = last >= first;

    const totalRow = ws.addRow([
      "TOTAL", "", null,
      hasRows ? { formula: `SUM(D${first}:D${last})` } : 0,
      hasRows ? { formula: `SUM(E${first}:E${last})` } : 0,
      null, null,
    ]);
    totalRow.getCell(6).value = { formula: `E${totalRow.number}-D${totalRow.number}` };
    totalRow.getCell(7).value = {
      formula: `IFERROR(F${totalRow.number}/E${totalRow.number},0)`,
    };
    styleTotal(totalRow);

    for (const col of [4, 5, 6]) ws.getColumn(col).numFmt = moneyFmt;
    ws.getColumn(7).numFmt = "0.0%";

    ws.addRow([]);
    const note = ws.addRow([
      "Catatan: baris jasa modalnya nol sehingga marginnya 100%. " +
      "Proyek hanya muncul bila statusnya sudah Selesai.",
    ]);
    note.font = { italic: true, size: 9, color: { argb: "FF6B7280" } };

    return xlsxResponse(await wb.xlsx.writeBuffer(), `Analisa-Margin-${from}_${to}.xlsx`);
  } catch (err) {
    console.error("Export analisa margin error:", err);
    return NextResponse.json({ error: "Gagal membuat laporan" }, { status: 500 });
  }
}
