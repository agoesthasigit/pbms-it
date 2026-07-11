"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { success?: boolean; error?: string };

export type DistributorInput = {
  name: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
};

function clean(input: DistributorInput) {
  return {
    name: input.name.trim(),
    contact_name: input.contact_name?.trim() || null,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    address: input.address?.trim() || null,
    notes: input.notes?.trim() || null,
  };
}

export async function addDistributor(input: DistributorInput): Promise<Result> {
  if (!input.name.trim()) return { error: "Nama distributor wajib diisi." };
  const supabase = await createClient();
  const { error } = await supabase.from("distributors").insert(clean(input));
  if (error) return { error: "Gagal menambah distributor." };
  revalidatePath("/distributors");
  return { success: true };
}

export async function updateDistributor(
  id: string,
  input: DistributorInput
): Promise<Result> {
  if (!input.name.trim()) return { error: "Nama distributor wajib diisi." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("distributors")
    .update(clean(input))
    .eq("id", id);
  if (error) return { error: "Gagal mengubah distributor." };
  revalidatePath("/distributors");
  return { success: true };
}

export async function deleteDistributor(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("distributors").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return {
        error: "Distributor sudah punya data pembelian dan tidak bisa dihapus.",
      };
    }
    return { error: "Gagal menghapus distributor." };
  }
  revalidatePath("/distributors");
  return { success: true };
}
