import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { createClient } from "@/lib/supabase/server";
import { buildTransactionRows } from "@/lib/reports/transactions";
import { TX_SOURCE_LABEL } from "@/types/reports";
import { TransactionsPdf } from "./transactions-pdf";
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
    const all = await buildTransactionRows(supabase);
    const rows = all
      .filter((r) => r.date && r.date >= from && r.date <= to)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

    // Baris "ditagih via invoice" sengaja tidak dijumlahkan (lihat countInTotal).
    const counted = rows.filter((r) => r.countInTotal !== false);
    const totalIn = counted.filter((r) => r.direction === "in")
      .reduce((s, r) => s + r.amount, 0);
    const totalOut = counted.filter((r) => r.direction === "out")
      .reduce((s, r) => s + r.amount, 0);

    // ---------------- PDF ----------------
    if (format === "pdf") {
      const buffer = await renderToBuffer(
        createElement(TransactionsPdf, {
          rows, from, to, totalIn, totalOut,
        }) as ReactElement<DocumentProps>
      );
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="Riwayat-Transaksi-${from}_${to}.pdf"`,
        },
      });
    }

    // ---------------- EXCEL ----------------
    const wb = new ExcelJS.Workbook();
    wb.creator = "Athaya Computer — PBMS-IT";
    wb.created = new Date();

    const ws = wb.addWorksheet("Transaksi");
    ws.columns = [
      { width: 12 }, { width: 26 }, { width: 16 }, { width: 40 },
      { width: 18 }, { width: 18 }, { width: 18 }, { width: 22 },
    ];

    styleTitle(ws, "RIWAYAT TRANSAKSI", `Periode ${from} s/d ${to}`);

    const header = ws.addRow([
      "Tanggal", "Pihak", "Jenis", "Keterangan",
      "Wallet", "Pemasukan", "Pengeluaran", "Catatan",
    ]);
    styleTableHeader(header);
    ws.views = [{ state: "frozen", ySplit: header.number }];

    const first = ws.rowCount + 1;
    for (const r of rows) {
      const skipped = r.countInTotal === false;
      const note = [
        r.isPiutang ? "Piutang belum diterima" : "",
        skipped ? "Ditagih via invoice — tidak dijumlahkan" : "",
      ].filter(Boolean).join(" · ");

      const row = ws.addRow([
        r.date ? new Date(r.date) : null,
        r.party,
        TX_SOURCE_LABEL[r.source],
        r.description || TX_SOURCE_LABEL[r.source],
        r.walletName,
        // Baris yang tidak dijumlahkan tetap ditulis nilainya di kolom Catatan
        // saja agar SUM di bawah tidak ikut menghitungnya.
        r.direction === "in" && !skipped ? r.amount : null,
        r.direction === "out" && !skipped ? r.amount : null,
        note,
      ]);
      if (skipped || r.isPiutang) {
        row.font = { color: { argb: "FF9CA3AF" }, italic: true };
      }
    }
    const last = ws.rowCount;
    const hasRows = last >= first;

    const totalRow = ws.addRow([
      "TOTAL", "", "", "", "",
      hasRows ? { formula: `SUM(F${first}:F${last})` } : 0,
      hasRows ? { formula: `SUM(G${first}:G${last})` } : 0,
      "",
    ]);
    styleTotal(totalRow);

    const netRow = ws.addRow([
      "SELISIH (NET)", "", "", "", "",
      { formula: `F${totalRow.number}-G${totalRow.number}` }, "", "",
    ]);
    netRow.font = { bold: true };

    ws.getColumn(1).numFmt = "dd/mm/yyyy";
    ws.getColumn(6).numFmt = moneyFmt;
    ws.getColumn(7).numFmt = moneyFmt;

    ws.addRow([]);
    const note = ws.addRow([
      "Catatan: penjualan metode Invoice Bulanan ditampilkan tapi tidak dijumlahkan — " +
      "uangnya dihitung pada baris pelunasan invoice (netto setelah PPh 23) agar tidak dobel.",
    ]);
    note.font = { italic: true, size: 9, color: { argb: "FF6B7280" } };

    return xlsxResponse(await wb.xlsx.writeBuffer(), `Riwayat-Transaksi-${from}_${to}.xlsx`);
  } catch (err) {
    console.error("Export riwayat transaksi error:", err);
    return NextResponse.json({ error: "Gagal membuat laporan" }, { status: 500 });
  }
}
