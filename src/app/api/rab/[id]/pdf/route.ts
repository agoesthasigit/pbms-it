import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { RabPdf } from "./rab-pdf";
import type { RabItem, RabPayment } from "@/types/phase7";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: project } = await supabase
    .from("v_rab_summary").select("*").eq("id", id).single();
  if (!project) return new NextResponse("RAB tidak ditemukan", { status: 404 });

  const [{ data: items }, { data: payments }, { data: wallets }] = await Promise.all([
    supabase.from("rab_items").select("*").eq("rab_id", id).order("sort_order"),
    supabase.from("rab_payments").select("*").eq("rab_id", id).order("payment_date"),
    supabase.from("wallets").select("id, name"),
  ]);

  const walletNames: Record<string, string> = {};
  for (const w of (wallets ?? []) as { id: string; name: string }[]) {
    walletNames[w.id] = w.name;
  }

  const all = (items ?? []) as RabItem[];
  const budget = all.filter((i) => i.item_type === "budget");
  const expense = all.filter((i) => i.item_type === "expense");

  const buffer = await renderToBuffer(
    RabPdf({
      project, budget, expense,
      payments: (payments ?? []) as RabPayment[],
      walletNames,
    }) as unknown as Parameters<typeof renderToBuffer>[0]
  );

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="RAB-${project.project_name.replace(/[^a-z0-9]/gi, "-")}.pdf"`,
    },
  });
}
