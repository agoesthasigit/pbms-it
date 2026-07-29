"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PaymentMethod } from "@/types/phase3";
import { buildSalePdf } from "@/lib/pdf/build-sale-pdf";
import { sendMail, isMailerConfigured } from "@/lib/email/mailer";
import { composeEmail } from "@/lib/email/signature";

type Result = { success?: boolean; error?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SaleItemInput = {
  product_id: string;
  qty: number;
  price: number;
  warranty_months: number;
  serial_number?: string;
};

export async function createSale(input: {
  client_id: string;
  wallet_id: string | null;
  sale_date: string;
  payment_method: PaymentMethod;
  notes?: string;
  items: SaleItemInput[];
  period_month?: string | null;   // untuk piutang
  due_date?: string | null;       // untuk piutang
}): Promise<Result> {
  const paysNow = input.payment_method === "cash" || input.payment_method === "transfer";
  if (!input.client_id) return { error: "Pilih client." };
  if (paysNow && !input.wallet_id)
    return { error: "Penjualan tunai/transfer wajib memilih wallet." };
  if (input.payment_method === "monthly_invoice" && !input.period_month)
    return { error: "Penjualan invoice wajib memilih periode." };
  const valid = input.items.filter((i) => i.product_id && i.qty > 0);
  if (valid.length === 0) return { error: "Tambahkan minimal 1 barang." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_sale", {
    p_client_id: input.client_id,
    p_wallet_id: paysNow ? input.wallet_id : null,
    p_sale_date: input.sale_date,
    p_payment_method: input.payment_method,
    p_notes: input.notes ?? "",
    p_items: valid,
    p_period_month: input.payment_method === "monthly_invoice"
      ? `${input.period_month}-01` : null,
    // due_date dipakai invoice bulanan (jatuh tempo invoice) & terhutang (jatuh tempo piutang)
    p_due_date: (input.payment_method === "monthly_invoice"
      || input.payment_method === "terhutang")
      ? (input.due_date || null) : null,
  });

  if (error) return { error: error.message || "Gagal menyimpan penjualan." };
  revalidatePath("/sales");
  revalidatePath("/products");
  revalidatePath("/wallets");
  revalidatePath("/assets");
  revalidatePath("/invoices");
  return { success: true };
}

export async function paySale(input: {
  sale_id: string;
  wallet_id: string;
  paid_date: string;
}): Promise<Result> {
  if (!input.wallet_id) return { error: "Pilih wallet penerima." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("pay_sale", {
    p_sale_id: input.sale_id,
    p_wallet_id: input.wallet_id,
    p_paid_date: input.paid_date,
  });
  if (error) return { error: error.message || "Gagal melunasi penjualan." };
  revalidatePath("/sales");
  revalidatePath("/wallets");
  return { success: true };
}

export async function sendSaleEmail(input: {
  sale_id: string;
  to: string;
  subject: string;
  body: string;
}): Promise<Result> {
  const to = input.to.trim();
  if (!to) return { error: "Email tujuan kosong. Isi email client terlebih dahulu." };
  if (!EMAIL_RE.test(to)) return { error: "Format email tujuan tidak valid." };
  if (!input.subject.trim()) return { error: "Subject email tidak boleh kosong." };
  if (!isMailerConfigured())
    return { error: "Email pengirim belum dikonfigurasi. Isi GMAIL_APP_PASSWORD di .env.local lalu restart server." };

  const supabase = await createClient();

  // Bangun NOTA PDF (sekaligus validasi kelayakan metode bayar)
  const pdf = await buildSalePdf(supabase, input.sale_id);
  if (!pdf.ok) return { error: pdf.message };

  // Rangkai isi + tanda tangan (logo inline) → HTML & teks
  const mail = await composeEmail(input.body);

  try {
    await sendMail({
      to,
      subject: input.subject.trim(),
      text: mail.text,
      html: mail.html,
      attachments: [
        { filename: pdf.fileName, content: pdf.buffer, contentType: "application/pdf" },
        ...mail.attachments,
      ],
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal mengirim email." };
  }

  const { error: upErr } = await supabase
    .from("sales")
    .update({ email_sent_at: new Date().toISOString(), email_sent_to: to })
    .eq("id", input.sale_id);
  if (upErr) return { error: `Email terkirim, tapi gagal mencatat status: ${upErr.message}` };

  revalidatePath("/sales");
  return { success: true };
}

export async function deleteSale(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_sale", { p_id: id });
  if (error) return { error: error.message || "Gagal menghapus penjualan." };
  revalidatePath("/sales");
  revalidatePath("/products");
  revalidatePath("/wallets");
  revalidatePath("/assets");
  revalidatePath("/invoices");
  return { success: true };
}
