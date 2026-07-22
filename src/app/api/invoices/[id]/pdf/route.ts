import { NextResponse } from "next/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { InvoicePdf } from "./invoice-pdf";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  // pastikan user login (RLS tetap melindungi, ini untuk pesan yang jelas)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: invoice } = await supabase
    .from("v_monthly_invoices").select("*").eq("id", id).single();
  if (!invoice) return new NextResponse("Invoice tidak ditemukan", { status: 404 });

  const { data: sales } = await supabase
    .from("sales")
    .select("id, sale_date, maintenance_contract_id, sale_items(qty, price, subtotal, product:products(name))")
    .eq("monthly_invoice_id", id)
    .order("sale_date");

  // rangkai baris item untuk PDF
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
      qty: number; price: number; subtotal: number; product: { name: string } | null;
    }[])) {
      rows.push({
        name: it.product?.name ?? "-",
        qty: it.qty, price: Number(it.price), subtotal: Number(it.subtotal),
        date: s.sale_date,
      });
    }
  }

  const buffer = await renderToBuffer(
    InvoicePdf({ invoice, rows }) as React.ReactElement<DocumentProps>
  );

  // ===== Nama file: <Nama Perusahaan>-<No Invoice>.pdf =====
  // contoh: "Robpeetoom-Ubud-INV-2026-08-001.pdf"
  const clientPart = String(invoice.company_name ?? "Client")
    .replace(/[/\\:*?"<>|]/g, " ") // buang karakter ilegal utk nama file
    .replace(/\s+/g, " ")          // rapikan spasi ganda
    .trim()
    .replace(/\s/g, "-");          // spasi -> tanda hubung
  const invoicePart = String(invoice.invoice_no).replace(/\//g, "-"); // INV/2026/08/001 -> INV-2026-08-001
  const fileName = `${clientPart}-${invoicePart}.pdf`;
  // versi ASCII sebagai cadangan (untuk browser lama), + filename* UTF-8 (nama lengkap)
  const asciiName = fileName.replace(/[^\x20-\x7E]/g, "");

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
