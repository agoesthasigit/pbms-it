"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { InvoiceStatus } from "@/types/phase4";
import { buildInvoicePdf } from "@/lib/pdf/build-invoice-pdf";
import { sendMail, isMailerConfigured } from "@/lib/email/mailer";
import { composeEmail } from "@/lib/email/signature";

type Result = { success?: boolean; error?: string; invoiceId?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function generateInvoice(input: {
  client_id: string;
  period_month: string;
  due_date: string;
}): Promise<Result> {
  if (!input.client_id) return { error: "Pilih client." };
  if (!input.period_month) return { error: "Pilih periode bulan." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_monthly_invoice", {
    p_client_id: input.client_id,
    p_period_month: input.period_month,
    p_due_date: input.due_date || null,
  });

  if (error) return { error: error.message || "Gagal membuat invoice." };
  revalidatePath("/invoices");
  revalidatePath("/sales");
  return { success: true, invoiceId: data as string };
}

export async function markInvoicePaid(input: {
  invoice_id: string;
  wallet_id: string;
  paid_date: string;
}): Promise<Result> {
  if (!input.wallet_id) return { error: "Pilih wallet penerima." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_invoice_paid", {
    p_invoice_id: input.invoice_id,
    p_wallet_id: input.wallet_id,
    p_paid_date: input.paid_date,
  });
  if (error) return { error: error.message || "Gagal menandai lunas." };
  revalidatePath("/invoices");
  revalidatePath("/wallets");
  return { success: true };
}

export async function setInvoiceStatus(
  invoice_id: string,
  status: Exclude<InvoiceStatus, "paid" | "overdue">
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_invoice_status", {
    p_invoice_id: invoice_id,
    p_status: status,
  });
  if (error) return { error: error.message || "Gagal mengubah status." };
  revalidatePath("/invoices");
  return { success: true };
}

export async function sendInvoiceEmail(input: {
  invoice_id: string;
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

  // Bangun PDF (isi & nama file identik dengan tombol Unduh PDF)
  const pdf = await buildInvoicePdf(supabase, input.invoice_id);
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

  // Catat jejak kirim + tandai terkirim bila masih draft
  const updates: Record<string, unknown> = {
    email_sent_at: new Date().toISOString(),
    email_sent_to: to,
  };
  if (pdf.invoice.status === "draft") updates.status = "sent";
  const { error: upErr } = await supabase
    .from("monthly_invoices").update(updates).eq("id", input.invoice_id);
  if (upErr) return { error: `Email terkirim, tapi gagal mencatat status: ${upErr.message}` };

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${input.invoice_id}`);
  return { success: true };
}

export async function deleteInvoice(invoice_id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_monthly_invoice", {
    p_invoice_id: invoice_id,
  });
  if (error) return { error: error.message || "Gagal menghapus invoice." };
  revalidatePath("/invoices");
  revalidatePath("/sales");
  revalidatePath("/wallets");
  return { success: true };
}
