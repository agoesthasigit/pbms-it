"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ClientStatus } from "@/types/db";

type Result = { success?: boolean; error?: string };

export type ClientInput = {
  company_name: string;
  contact_name?: string;
  category_id?: string | null;
  email?: string;
  address?: string;
  phone?: string;
  status: ClientStatus;
  joined_date?: string;
  notes?: string;
};

function clean(input: ClientInput) {
  return {
    company_name: input.company_name.trim(),
    contact_name: input.contact_name?.trim() || null,
    category_id: input.category_id || null,
    email: input.email?.trim() || null,
    address: input.address?.trim() || null,
    phone: input.phone?.trim() || null,
    status: input.status,
    joined_date: input.joined_date || null,
    notes: input.notes?.trim() || null,
  };
}

export async function addClientData(input: ClientInput): Promise<Result> {
  if (!input.company_name.trim())
    return { error: "Nama perusahaan wajib diisi." };
  const supabase = await createClient();
  const { error } = await supabase.from("clients").insert(clean(input));
  if (error) return { error: "Gagal menambah client." };
  revalidatePath("/clients");
  return { success: true };
}

export async function updateClientData(
  id: string,
  input: ClientInput
): Promise<Result> {
  if (!input.company_name.trim())
    return { error: "Nama perusahaan wajib diisi." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update(clean(input))
    .eq("id", id);
  if (error) return { error: "Gagal mengubah client." };
  revalidatePath("/clients");
  return { success: true };
}

export async function deleteClientData(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return {
        error:
          "Client sudah punya data transaksi/asset dan tidak bisa dihapus. Ubah statusnya menjadi Nonaktif.",
      };
    }
    return { error: "Gagal menghapus client." };
  }
  revalidatePath("/clients");
  return { success: true };
}
