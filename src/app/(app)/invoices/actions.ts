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
  /** Dasar kena pajak = nilai JASA saja. 0 = tidak ada potongan PPh. */
  pph_base?: number;
  /** Tarif PPh 23 dalam persen (default 2,5). */
  pph_rate?: number;
}): Promise<Result> {
  if (!input.wallet_id) return { error: "Pilih wallet penerima." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_invoice_paid", {
    p_invoice_id: input.invoice_id,
    p_wallet_id: input.wallet_id,
    p_paid_date: input.paid_date,
    p_pph_base: input.pph_base ?? 0,
    p_pph_rate: input.pph_rate ?? 2.5,
  });
  if (error) return { error: error.message || "Gagal menandai lunas." };
  revalidatePath("/invoices");
  revalidatePath("/wallets");
  revalidatePath("/reports");
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
  if (!(await isMailerConfigured()))
    return { error: "Email pengirim belum dikonfigurasi. Isi di menu Pengaturan → Email." };

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

// ── Edit/Hapus baris invoice (hanya invoice BELUM LUNAS) ────────────────────

/** Hapus satu baris invoice: balikkan stok (barang), hapus aset, hitung ulang. */
export async function deleteInvoiceItem(input: {
  sale_item_id: string;
  invoice_id: string;
}): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_invoice_item", {
    p_sale_item_id: input.sale_item_id,
  });
  if (error) return { error: error.message || "Gagal menghapus baris." };
  revalidatePath(`/invoices/${input.invoice_id}`);
  revalidatePath("/invoices");
  revalidatePath("/sales");
  revalidatePath("/products");
  revalidatePath("/reports");
  return { success: true };
}

/** Edit baris invoice: harga (semua baris) + nama (baris jasa saja). */
export async function updateInvoiceItem(input: {
  sale_item_id: string;
  invoice_id: string;
  item_name?: string | null;
  price: number;
}): Promise<Result> {
  if (!(input.price >= 0)) return { error: "Harga tidak valid." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_invoice_item", {
    p_sale_item_id: input.sale_item_id,
    p_item_name: input.item_name ?? null,
    p_price: input.price,
  });
  if (error) return { error: error.message || "Gagal menyimpan perubahan." };
  revalidatePath(`/invoices/${input.invoice_id}`);
  revalidatePath("/invoices");
  revalidatePath("/sales");
  revalidatePath("/reports");
  return { success: true };
}

/** Tambah baris (barang/jasa) langsung ke invoice belum lunas. */
export async function addInvoiceItem(input: {
  invoice_id: string;
  is_service: boolean;
  product_id?: string | null;
  item_name?: string | null;
  qty: number;
  price: number;
  warranty_months?: number;
  serial?: string | null;
}): Promise<Result> {
  if (!(input.qty > 0)) return { error: "Qty harus lebih dari 0." };
  if (!(input.price >= 0)) return { error: "Harga tidak valid." };
  if (input.is_service) {
    if (!input.item_name?.trim()) return { error: "Nama jasa tidak boleh kosong." };
  } else if (!input.product_id) {
    return { error: "Barang wajib dipilih." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_invoice_item", {
    p_invoice_id: input.invoice_id,
    p_is_service: input.is_service,
    p_product_id: input.product_id ?? null,
    p_item_name: input.item_name ?? null,
    p_qty: input.qty,
    p_price: input.price,
    p_warranty_months: input.warranty_months ?? 12,
    p_serial: input.serial ?? null,
  });
  if (error) return { error: error.message || "Gagal menambah baris." };
  revalidatePath(`/invoices/${input.invoice_id}`);
  revalidatePath("/invoices");
  revalidatePath("/sales");
  revalidatePath("/products");
  revalidatePath("/reports");
  return { success: true };
}

/** Batal Lunas: balik pemasukan wallet + PPh, status kembali ke sent/draft. */
export async function unpayInvoice(invoice_id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("unpay_invoice", {
    p_invoice_id: invoice_id,
  });
  if (error) return { error: error.message || "Gagal membatalkan lunas." };
  revalidatePath(`/invoices/${invoice_id}`);
  revalidatePath("/invoices");
  revalidatePath("/wallets");
  revalidatePath("/reports");
  return { success: true };
}
