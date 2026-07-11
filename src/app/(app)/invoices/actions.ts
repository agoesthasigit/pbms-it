"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { InvoiceStatus } from "@/types/phase4";

type Result = { success?: boolean; error?: string; invoiceId?: string };

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
