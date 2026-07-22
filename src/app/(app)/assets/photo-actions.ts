"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MAX_PHOTOS_PER_ASSET } from "@/types/asset-photo";

const BUCKET = "asset-photos";

type Result = { success?: boolean; error?: string; path?: string };

// Upload 1 foto (hasil kompresi browser, biasanya JPG) untuk sebuah aset.
// FormData: file (Blob), asset_id, file_size, ext, mime
export async function uploadAssetPhoto(form: FormData): Promise<Result> {
  const file = form.get("file") as File | null;
  const assetId = String(form.get("asset_id") ?? "");
  const fileSize = Number(form.get("file_size") ?? 0);

  if (!file) return { error: "File tidak ada." };
  if (!assetId) return { error: "Aset tidak valid." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sesi berakhir, silakan login ulang." };

  // batasi maksimal 2 foto per aset
  const { count } = await supabase
    .from("asset_photos")
    .select("id", { count: "exact", head: true })
    .eq("asset_id", assetId);
  if ((count ?? 0) >= MAX_PHOTOS_PER_ASSET) {
    return { error: `Maksimal ${MAX_PHOTOS_PER_ASSET} foto per aset.` };
  }

  // Ekstensi & tipe mengikuti hasil kompresi di browser (default JPG).
  // Dibatasi daftar aman agar nilai dari klien tidak dipakai mentah-mentah.
  const rawExt = String(form.get("ext") ?? "jpg").toLowerCase();
  const ext = rawExt === "png" ? "png" : rawExt === "webp" ? "webp" : "jpg";
  const contentType =
    ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

  // path: <user_id>/<asset_id>/<uuid>.<ext>  (folder pertama = user_id untuk RLS)
  const uuid = crypto.randomUUID();
  const path = `${user.id}/${assetId}/${uuid}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType, upsert: false });
  if (upErr) return { error: `Gagal upload foto: ${upErr.message}` };

  const { error: dbErr } = await supabase.from("asset_photos").insert({
    asset_id: assetId,
    storage_path: path,
    file_size: fileSize,
    sort_order: count ?? 0,
  });
  if (dbErr) {
    // rollback file bila insert db gagal
    await supabase.storage.from(BUCKET).remove([path]);
    return { error: `Gagal menyimpan data foto: ${dbErr.message}` };
  }

  revalidatePath("/assets");
  return { success: true, path };
}

// Hapus 1 foto (dari storage + db)
export async function deleteAssetPhoto(photoId: string): Promise<Result> {
  const supabase = await createClient();

  const { data: photo } = await supabase
    .from("asset_photos").select("storage_path").eq("id", photoId).single();
  if (!photo) return { error: "Foto tidak ditemukan." };

  await supabase.storage.from(BUCKET).remove([photo.storage_path]);
  const { error } = await supabase.from("asset_photos").delete().eq("id", photoId);
  if (error) return { error: "Gagal menghapus foto." };

  revalidatePath("/assets");
  return { success: true };
}

// Ambil daftar foto sebuah aset + signed URL (bucket privat)
export async function getAssetPhotos(assetId: string) {
  const supabase = await createClient();
  const { data: photos } = await supabase
    .from("asset_photos").select("*").eq("asset_id", assetId).order("sort_order");
  if (!photos || photos.length === 0) return [];

  const withUrls = await Promise.all(
    photos.map(async (p) => {
      const { data } = await supabase.storage
        .from(BUCKET).createSignedUrl(p.storage_path, 60 * 60); // 1 jam
      return { ...p, signed_url: data?.signedUrl };
    })
  );
  return withUrls;
}
