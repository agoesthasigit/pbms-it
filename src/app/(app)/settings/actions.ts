"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CategoryType } from "@/types/db";

type Result = { success?: boolean; error?: string };

// ---------- KATEGORI ----------
export async function addCategory(
  name: string,
  type: CategoryType
): Promise<Result> {
  const clean = name.trim();
  if (!clean) return { error: "Nama kategori wajib diisi." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .insert({ name: clean, type });

  if (error) return { error: "Gagal menambah kategori. Coba lagi." };
  revalidatePath("/settings");
  return { success: true };
}

export async function toggleCategory(
  id: string,
  isActive: boolean
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) return { error: "Gagal mengubah status kategori." };
  revalidatePath("/settings");
  return { success: true };
}

export async function deleteCategory(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);

  if (error) {
    // 23503 = foreign key violation (kategori sudah dipakai data lain)
    if (error.code === "23503") {
      return {
        error:
          "Kategori sudah dipakai data lain dan tidak bisa dihapus. Nonaktifkan saja.",
      };
    }
    return { error: "Gagal menghapus kategori." };
  }
  revalidatePath("/settings");
  return { success: true };
}

// ---------- LABEL ----------
export async function addLabel(name: string, color: string): Promise<Result> {
  const clean = name.trim();
  if (!clean) return { error: "Nama label wajib diisi." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("labels")
    .insert({ name: clean, color });

  if (error) return { error: "Gagal menambah label." };
  revalidatePath("/settings");
  return { success: true };
}

export async function deleteLabel(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("labels").delete().eq("id", id);

  if (error) {
    if (error.code === "23503") {
      return {
        error: "Label sudah dipakai data lain dan tidak bisa dihapus.",
      };
    }
    return { error: "Gagal menghapus label." };
  }
  revalidatePath("/settings");
  return { success: true };
}

// ---------- EMAIL (Gmail) ----------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Simpan pengaturan email Gmail ke DB (password terenkripsi via pgcrypto).
 * Password hanya diperbarui bila `password` diisi — kosongkan untuk
 * mempertahankan password lama saat hanya mengubah user/nama pengirim.
 */
export async function saveEmailSettings(input: {
  gmail_user: string;
  from_name: string;
  app_password: string;
}): Promise<Result> {
  const user = input.gmail_user.trim();
  if (!user) return { error: "Email pengirim (Gmail) wajib diisi." };
  if (!EMAIL_RE.test(user)) return { error: "Format email pengirim tidak valid." };

  const key = process.env.CREDENTIALS_SECRET_KEY;
  if (!key)
    return { error: "CREDENTIALS_SECRET_KEY belum diset di environment. Hubungi admin." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_email_settings", {
    p_user: user,
    p_from_name: input.from_name.trim(),
    p_password: input.app_password.replace(/\s+/g, ""), // App Password tanpa spasi
    p_key: key,
  });
  if (error) return { error: error.message || "Gagal menyimpan pengaturan email." };
  revalidatePath("/settings");
  return { success: true };
}
