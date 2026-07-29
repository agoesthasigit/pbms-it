import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildInvoicePdf } from "@/lib/pdf/build-invoice-pdf";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  // pastikan user login (RLS tetap melindungi, ini untuk pesan yang jelas)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const res = await buildInvoicePdf(supabase, id);
  if (!res.ok) return new NextResponse(res.message, { status: res.status });

  // versi ASCII sebagai cadangan (untuk browser lama), + filename* UTF-8 (nama lengkap)
  const asciiName = res.fileName.replace(/[^\x20-\x7E]/g, "");

  return new NextResponse(res.buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(res.fileName)}`,
    },
  });
}
