import "server-only";
import { NextResponse } from "next/server";
import type ExcelJS from "exceljs";

/**
 * Potongan yang dipakai bersama oleh semua route export laporan
 * (Laba Rugi, Analisa Margin, Riwayat Transaksi) agar gaya file Excel
 * dan penanganan periode-nya seragam.
 */

export const moneyFmt = '"Rp"#,##0;[Red]-"Rp"#,##0;"-"';

const TEAL = "FF0F766E";

const isISODate = (v: string | null): v is string =>
  !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Baca ?from=&to=; kalau tidak valid, pakai bulan berjalan. */
export function resolvePeriod(url: URL): { from: string; to: string } {
  const qFrom = url.searchParams.get("from");
  const qTo = url.searchParams.get("to");
  if (isISODate(qFrom) && isISODate(qTo) && qFrom <= qTo) {
    return { from: qFrom, to: qTo };
  }
  const now = new Date();
  const f = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return {
    from: f(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: f(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

/** Judul besar + baris periode di puncak sheet. */
export function styleTitle(ws: ExcelJS.Worksheet, title: string, subtitle: string) {
  const t = ws.addRow([title]);
  t.font = { bold: true, size: 14, color: { argb: TEAL } };
  const s = ws.addRow([subtitle]);
  s.font = { italic: true, size: 10, color: { argb: "FF6B7280" } };
  ws.addRow([]);
}

/** Judul bagian A/B/C/… dengan latar teal. */
export function styleSection(ws: ExcelJS.Worksheet, label: string) {
  ws.addRow([]);
  const r = ws.addRow([label]);
  r.font = { bold: true, color: { argb: "FFFFFFFF" } };
  r.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
  });
  // beri latar juga pada kolom kosong supaya baris judul rata penuh
  for (let i = 1; i <= 3; i++) {
    const cell = r.getCell(i);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  }
}

/** Baris total: tebal + garis atas. */
export function styleTotal(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.eachCell((c) => {
    c.border = { top: { style: "thin", color: { argb: "FFD1D5DB" } } };
  });
}

/** Header tabel bergaya teal (untuk sheet berbentuk tabel). */
export function styleTableHeader(row: ExcelJS.Row) {
  row.height = 20;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });
}

/** Bungkus buffer workbook menjadi respons unduhan .xlsx. */
export function xlsxResponse(buffer: ExcelJS.Buffer, fileName: string) {
  return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
