import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { createClient } from "@/lib/supabase/server";
import { buildMarginReport } from "@/lib/reports/margin";
import { MarginPdf } from "./margin-pdf";
import {
  resolvePeriod, moneyFmt, styleTitle, styleSection, styleTableHeader, styleTotal, xlsxResponse,
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

    // ---------------- REKONSILIASI INVOICE vs PEMBAYARAN ----------------
    ws.addRow([]);
    styleSection(ws, "REKONSILIASI INVOICE vs PEMBAYARAN DITERIMA");
    const rHeader = ws.addRow([
      "Invoice", "Client", "Bruto", "Dasar Pajak (Jasa)", "PPh 2,5%", "Diterima (Netto)", "Cek",
    ]);
    styleTableHeader(rHeader);

    const rFirst = ws.rowCount + 1;
    for (const r of data.recon) {
      const row = ws.addRow([
        r.invoice_no, r.client, r.bruto, r.dpp, null, null, null,
      ]);
      // PPh, netto, dan cek memakai RUMUS agar sheet tetap hidup.
      row.getCell(5).value = { formula: `ROUND(D${row.number}*0.025,0)` };
      row.getCell(6).value = { formula: `C${row.number}-E${row.number}` };
      row.getCell(7).value = {
        formula: `IF(ABS(C${row.number}-E${row.number}-F${row.number})<1,"OK","CEK")`,
      };
    }
    const rLast = ws.rowCount;
    const hasRecon = rLast >= rFirst;
    const rTotal = ws.addRow([
      "TOTAL", "",
      hasRecon ? { formula: `SUM(C${rFirst}:C${rLast})` } : 0,
      hasRecon ? { formula: `SUM(D${rFirst}:D${rLast})` } : 0,
      hasRecon ? { formula: `SUM(E${rFirst}:E${rLast})` } : 0,
      hasRecon ? { formula: `SUM(F${rFirst}:F${rLast})` } : 0,
      "",
    ]);
    styleTotal(rTotal);
    for (const col of [3, 4, 5, 6]) ws.getColumn(col).numFmt = moneyFmt;

    ws.addRow([]);
    const rNote = ws.addRow([
      "Catatan: PPh 23 (2,5%) hanya atas nilai jasa; penjualan barang tidak kena. " +
      "Netto = uang yang benar-benar masuk ke wallet. Dasar pajak = nilai jasa yang " +
      "tercatat saat pelunasan invoice.",
    ]);
    rNote.font = { italic: true, size: 9, color: { argb: "FF6B7280" } };

    return xlsxResponse(await wb.xlsx.writeBuffer(), `Analisa-Margin-${from}_${to}.xlsx`);
  } catch (err) {
    console.error("Export analisa margin error:", err);
    return NextResponse.json({ error: "Gagal membuat laporan" }, { status: 500 });
  }
}
