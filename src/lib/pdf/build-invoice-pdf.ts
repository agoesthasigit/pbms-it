import "server-only";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MonthlyInvoice } from "@/types/phase4";
import { InvoicePdf } from "@/app/api/invoices/[id]/pdf/invoice-pdf";

export type BuildPdfResult =
  | { ok: true; buffer: Buffer; fileName: string; invoice: MonthlyInvoice }
  | { ok: false; status: number; message: string };

/** Ubah nama client + no invoice menjadi nama file PDF yang aman. */
function toFileName(companyName: unknown, invoiceNo: unknown) {
  const clientPart = String(companyName ?? "Client")
    .replace(/[/\\:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s/g, "-");
  const invoicePart = String(invoiceNo).replace(/\//g, "-");
  return `${clientPart}-${invoicePart}.pdf`;
}

/**
 * Bangun buffer PDF untuk satu invoice bulanan.
 * Dipakai bersama oleh route handler unduh PDF dan action kirim email,
 * agar isi & penamaan file selalu identik.
 */
export async function buildInvoicePdf(
  supabase: SupabaseClient,
  id: string
): Promise<BuildPdfResult> {
  const { data: invoice } = await supabase
    .from("v_monthly_invoices").select("*").eq("id", id).single();
  if (!invoice) return { ok: false, status: 404, message: "Invoice tidak ditemukan" };

  const { data: sales } = await supabase
    .from("sales")
    .select("id, sale_date, maintenance_contract_id, sale_items(qty, price, subtotal, item_name, product:products(name))")
    .eq("monthly_invoice_id", id)
    .order("sale_date");

  // Baris maintenance selalu tampil PALING ATAS (item no.1), baru penjualan barang.
  const ordered = [...(sales ?? [])].sort((a, b) => {
    const am = (a as { maintenance_contract_id: string | null }).maintenance_contract_id ? 0 : 1;
    const bm = (b as { maintenance_contract_id: string | null }).maintenance_contract_id ? 0 : 1;
    if (am !== bm) return am - bm;
    return String(a.sale_date).localeCompare(String(b.sale_date));
  });

  const rows: { name: string; qty: number; price: number; subtotal: number; date: string }[] = [];
  for (const s of ordered) {
    for (const it of (s.sale_items as unknown as {
      qty: number; price: number; subtotal: number; item_name: string | null; product: { name: string } | null;
    }[])) {
      rows.push({
        name: it.item_name ?? it.product?.name ?? "-",
        qty: it.qty, price: Number(it.price), subtotal: Number(it.subtotal),
        date: s.sale_date,
      });
    }
  }

  const buffer = await renderToBuffer(
    InvoicePdf({ invoice, rows }) as React.ReactElement<DocumentProps>
  );

  return {
    ok: true,
    buffer: buffer as Buffer,
    fileName: toFileName(invoice.company_name, invoice.invoice_no),
    invoice: invoice as MonthlyInvoice,
  };
}
