import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildHutangPaymentPdf } from "@/lib/pdf/build-hutang-payment-pdf";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const idsParam = new URL(req.url).searchParams.get("ids") ?? "";
  const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);

  const res = await buildHutangPaymentPdf(supabase, ids);
  if (!res.ok) return new NextResponse(res.message, { status: res.status });

  const asciiName = res.fileName.replace(/[^\x20-\x7E]/g, "");
  return new NextResponse(res.buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(res.fileName)}`,
    },
  });
}
