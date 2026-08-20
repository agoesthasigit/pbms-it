"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildHutangPaymentPdf } from "@/lib/pdf/build-hutang-payment-pdf";
import { composeEmail } from "@/lib/email/signature";
import { sendMail, isMailerConfigured } from "@/lib/email/mailer";

type Result = { success?: boolean; error?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type PurchaseItemInput = {
  name: string;
  qty: number;
  price: number;
  selling_price?: number;   // opsional, untuk produk baru
  warranty_months?: number; // opsional
  unit?: string;            // opsional
};

export async function createPurchase(input: {
  distributor_id: string | null;
  /** Wajib untuk bayar langsung; null bila hutang (wallet menyusul saat bayar). */
  wallet_id: string | null;
  purchase_date: string;
  invoice_no?: string;
  notes?: string;
  items: PurchaseItemInput[];
  /** true = Hutang (bayar nanti). false = Bayar langsung. */
  is_credit?: boolean;
  /** Jatuh tempo (khusus hutang). */
  due_date?: string | null;
}): Promise<Result> {
  if (!input.is_credit && !input.wallet_id) return { error: "Pilih wallet pembayar." };
  const valid = input.items.filter((i) => i.name.trim() && i.qty > 0);
  if (valid.length === 0) return { error: "Tambahkan minimal 1 barang." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_purchase", {
    p_distributor_id: input.distributor_id,
    p_wallet_id: input.wallet_id,
    p_purchase_date: input.purchase_date,
    p_invoice_no: input.invoice_no ?? "",
    p_notes: input.notes ?? "",
    p_items: valid.map((i) => ({
      name: i.name.trim(),
      qty: i.qty,
      price: i.price,
      selling_price: i.selling_price ?? "",
      warranty_months: i.warranty_months ?? "",
      unit: i.unit ?? "",
    })),
    p_is_credit: input.is_credit ?? false,
    p_due_date: input.due_date ?? null,
  });

  if (error) return { error: error.message || "Gagal menyimpan pembelian." };
  revalidatePath("/purchases");
  revalidatePath("/products");
  revalidatePath("/wallets");
  revalidatePath("/piutang");
  return { success: true };
}

/** Lunasi beberapa nota hutang sekaligus (satu wallet, satu tanggal). */
export async function payPurchases(input: {
  ids: string[];
  wallet_id: string;
  paid_date: string;
}): Promise<Result> {
  if (!input.wallet_id) return { error: "Pilih wallet pembayar." };
  if (!input.ids || input.ids.length === 0) return { error: "Pilih minimal 1 nota." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("pay_purchases", {
    p_ids: input.ids,
    p_wallet_id: input.wallet_id,
    p_paid_date: input.paid_date,
  });

  if (error) return { error: error.message || "Gagal membayar hutang." };
  revalidatePath("/piutang");
  revalidatePath("/purchases");
  revalidatePath("/wallets");
  revalidatePath("/dashboard");
  return { success: true };
}

/** Kirim email bukti pelunasan hutang (satu email per pembayaran/distributor). */
export async function sendHutangPaymentEmail(input: {
  ids: string[];
  to: string;
  subject: string;
  body: string;
}): Promise<Result> {
  const to = input.to.trim();
  if (!to) return { error: "Email distributor kosong. Isi email distributor dulu." };
  if (!EMAIL_RE.test(to)) return { error: "Format email tujuan tidak valid." };
  if (!input.subject.trim()) return { error: "Subject email tidak boleh kosong." };
  if (!input.ids || input.ids.length === 0) return { error: "Tidak ada nota." };
  if (!(await isMailerConfigured()))
    return { error: "Email pengirim belum dikonfigurasi. Isi di menu Pengaturan → Email." };

  const supabase = await createClient();

  // PDF bukti (isi & nama file identik dengan tombol Unduh)
  const pdf = await buildHutangPaymentPdf(supabase, input.ids);
  if (!pdf.ok) return { error: pdf.message };

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

  // Tandai nota-nota dalam pembayaran ini sudah dikirim buktinya.
  await supabase.rpc("mark_hutang_payment_emailed", { p_ids: input.ids, p_to: to });
  revalidatePath("/piutang");
  return { success: true };
}

export type QuickDealItemInput = {
  name: string;
  qty: number;
  buy_price: number;
  sell_price: number;
  warranty_months?: number;
};

/** Transaksi Cepat: beli + jual sekaligus (atomik via RPC create_quick_deal). */
export async function createQuickDeal(input: {
  distributor_id: string | null;
  buy_wallet_id: string;
  deal_date: string;
  invoice_no?: string;
  client_id: string;
  sale_method: "cash" | "transfer" | "monthly_invoice" | "terhutang";
  sale_wallet_id: string | null;
  notes?: string;
  items: QuickDealItemInput[];
  period_month?: string | null;
  due_date?: string | null;
}): Promise<Result> {
  if (!input.buy_wallet_id) return { error: "Pilih wallet pembayar (pembelian)." };
  if (!input.client_id) return { error: "Pilih client (penjualan)." };
  const valid = input.items.filter((i) => i.name.trim() && i.qty > 0);
  if (valid.length === 0) return { error: "Tambahkan minimal 1 barang." };
  if ((input.sale_method === "cash" || input.sale_method === "transfer") && !input.sale_wallet_id)
    return { error: "Pilih wallet penerima penjualan." };
  if (input.sale_method === "monthly_invoice" && !input.period_month)
    return { error: "Pilih periode invoice bulanan." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_quick_deal", {
    p_distributor_id: input.distributor_id,
    p_buy_wallet_id: input.buy_wallet_id,
    p_deal_date: input.deal_date,
    p_invoice_no: input.invoice_no ?? "",
    p_client_id: input.client_id,
    p_sale_method: input.sale_method,
    p_sale_wallet_id: input.sale_wallet_id,
    p_notes: input.notes ?? "",
    p_items: valid.map((i) => ({
      name: i.name.trim(),
      qty: i.qty,
      buy_price: i.buy_price,
      sell_price: i.sell_price,
      warranty_months: i.warranty_months ?? "",
    })),
    p_period_month: input.period_month ?? null,
    p_due_date: input.due_date ?? null,
  });

  if (error) return { error: error.message || "Gagal menyimpan transaksi cepat." };
  revalidatePath("/purchases");
  revalidatePath("/sales");
  revalidatePath("/products");
  revalidatePath("/wallets");
  revalidatePath("/invoices");
  revalidatePath("/assets");
  return { success: true };
}

export async function deletePurchase(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_purchase", { p_id: id });
  if (error) return { error: error.message || "Gagal menghapus pembelian." };
  revalidatePath("/purchases");
  revalidatePath("/products");
  revalidatePath("/wallets");
  return { success: true };
}
