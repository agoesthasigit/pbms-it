import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
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
    .select("id, sale_date, sale_items(qty, price, subtotal, product:products(name))")
    .eq("monthly_invoice_id", id)
    .order("sale_date");

  // rangkai baris item untuk PDF
  const rows: { name: string; qty: number; price: number; subtotal: number; date: string }[] = [];
  for (const s of sales ?? []) {
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
    InvoicePdf({ invoice, rows }) as React.ReactElement
  );

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoice_no.replace(/\//g, "-")}.pdf"`,
    },
  });
}
