import "server-only";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  HutangPaymentPdf, type HutangPaymentRow,
} from "@/app/api/hutang-payment/pdf/hutang-payment-pdf";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type BuildHutangPdfResult =
  | {
      ok: true; buffer: Buffer; fileName: string;
      distributorName: string; distributorEmail: string | null;
      paidDate: string; total: number; invoiceNos: string[];
    }
  | { ok: false; status: number; message: string };

function safe(s: unknown) {
  return String(s ?? "-").replace(/[/\\:*?"<>|]/g, " ").replace(/\s+/g, " ").trim().replace(/\s/g, "-");
}

/**
 * Bangun PDF "Bukti Pembayaran Hutang" untuk sekumpulan nota (satu pembayaran
 * = nota-nota dengan distributor + tanggal bayar sama). Dipakai bersama oleh
 * route unduh & action kirim email agar isi/file identik.
 */
export async function buildHutangPaymentPdf(
  supabase: SupabaseClient,
  ids: string[]
): Promise<BuildHutangPdfResult> {
  if (!ids.length) return { ok: false, status: 400, message: "Tidak ada nota" };

  const { data } = await supabase
    .from("purchases")
    .select("id, invoice_no, purchase_date, total, paid_date, is_credit, notes, " +
      "distributor:distributors(name, email)")
    .in("id", ids)
    .eq("is_credit", true)
    .not("paid_date", "is", null);

  const notas = (data ?? []) as any[];
  if (notas.length === 0) return { ok: false, status: 404, message: "Nota tidak ditemukan / belum lunas" };

  const distributorName = notas[0].distributor?.name ?? "-";
  const distributorEmail = notas[0].distributor?.email ?? null;
  const paidDate = notas[0].paid_date as string;

  // Tujuan pengiriman disimpan di notes sbg "Tujuan: X | ..." (nota dari portal).
  const tujuan = (notes?: string | null): string | undefined => {
    const m = (notes ?? "").match(/Tujuan:\s*([^|]+)/i);
    return m ? m[1].trim() : undefined;
  };

  const rows: HutangPaymentRow[] = notas
    .map((p) => ({
      invoiceNo: p.invoice_no ?? "",
      purchaseDate: p.purchase_date,
      total: Number(p.total),
      destination: tujuan(p.notes),
    }))
    .sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate));
  const total = rows.reduce((s, r) => s + r.total, 0);
  const invoiceNos = rows.map((r) => r.invoiceNo).filter(Boolean);

  const buffer = await renderToBuffer(
    HutangPaymentPdf({ distributorName, paidDate, rows, total }) as React.ReactElement<DocumentProps>
  );

  return {
    ok: true,
    buffer: buffer as Buffer,
    fileName: `BuktiBayar-${safe(distributorName)}-${paidDate}.pdf`,
    distributorName,
    distributorEmail,
    paidDate,
    total,
    invoiceNos,
  };
}
