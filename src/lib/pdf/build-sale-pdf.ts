import "server-only";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentMethod } from "@/types/phase3";
import { SalePdf, type SaleNota } from "@/app/api/sales/[id]/pdf/sale-pdf";

const PAYMENT_LABEL: Record<string, string> = {
  cash: "Tunai",
  transfer: "Transfer",
  terhutang: "Terhutang (Lunas)",
};

export type BuildSaleResult =
  | { ok: true; buffer: Buffer; fileName: string; nota: SaleNota; clientEmail: string | null }
  | { ok: false; status: number; message: string };

/**
 * Bangun buffer NOTA PDF untuk satu penjualan (tunai/transfer/terhutang-lunas).
 * Termasuk penomoran nota permanen (nota_no) — disimpan sekali saat pertama dibuat.
 * Dipakai bersama route handler unduh & action kirim email.
 */
export async function buildSalePdf(
  supabase: SupabaseClient,
  id: string
): Promise<BuildSaleResult> {
  const { data: sale } = await supabase
    .from("sales")
    .select("id, sale_date, paid_date, payment_method, total, notes, nota_no, client:clients(company_name, contact_name, address, phone, email), sale_items(qty, price, subtotal, product:products(name))")
    .eq("id", id)
    .single();

  if (!sale) return { ok: false, status: 404, message: "Penjualan tidak ditemukan" };

  // Kelayakan: hanya tunai, transfer, atau terhutang yang SUDAH lunas.
  const method = sale.payment_method as PaymentMethod;
  const eligible =
    method === "cash" ||
    method === "transfer" ||
    (method === "terhutang" && !!sale.paid_date);
  if (!eligible) {
    return {
      ok: false, status: 403,
      message: "NOTA hanya tersedia untuk penjualan tunai, transfer, atau terhutang yang sudah lunas.",
    };
  }

  // Nomor NOTA permanen — diisi sekali saat pertama dibuat.
  let notaNo = sale.nota_no as string | null;
  if (!notaNo) {
    const notaDate = (sale.paid_date ?? sale.sale_date) as string;
    const d = new Date(notaDate);
    const prefix = `NOTA/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/`;

    const { data: existing } = await supabase
      .from("sales").select("nota_no").like("nota_no", `${prefix}%`);
    let maxSeq = 0;
    for (const r of existing ?? []) {
      const m = /\/(\d+)$/.exec((r as { nota_no: string | null }).nota_no ?? "");
      if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
    }
    notaNo = `${prefix}${String(maxSeq + 1).padStart(3, "0")}`;

    const { error: upErr } = await supabase
      .from("sales").update({ nota_no: notaNo }).eq("id", id);
    if (upErr) console.error("Gagal menyimpan nota_no:", upErr.message);
  }

  const client = sale.client as unknown as {
    company_name: string; contact_name: string | null;
    address: string | null; phone: string | null; email: string | null;
  } | null;

  const rows = (sale.sale_items as unknown as {
    qty: number; price: number; subtotal: number; product: { name: string } | null;
  }[]).map((it) => ({
    name: it.product?.name ?? "-",
    qty: it.qty, price: Number(it.price), subtotal: Number(it.subtotal),
  }));

  const nota: SaleNota = {
    nota_no: notaNo,
    sale_date: sale.sale_date as string,
    paid_date: (sale.paid_date ?? null) as string | null,
    payment_label: PAYMENT_LABEL[method] ?? method,
    total: Number(sale.total),
    company_name: client?.company_name ?? "Pelanggan",
    contact_name: client?.contact_name,
    client_address: client?.address,
    client_phone: client?.phone,
    notes: sale.notes as string | null,
  };

  const buffer = await renderToBuffer(
    SalePdf({ nota, rows }) as React.ReactElement<DocumentProps>
  );

  // Nama file: <Client>-<NoNota>.pdf
  const clientPart = (nota.company_name || "Client")
    .replace(/[/\\:*?"<>|]/g, " ").replace(/\s+/g, " ").trim().replace(/\s/g, "-");
  const notaPart = notaNo.replace(/\//g, "-");
  const fileName = `${clientPart}-${notaPart}.pdf`;

  return {
    ok: true,
    buffer: buffer as Buffer,
    fileName,
    nota,
    clientEmail: client?.email ?? null,
  };
}
