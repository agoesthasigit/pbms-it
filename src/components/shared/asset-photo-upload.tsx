"use client";

import { useRef, useState } from "react";
import { ImagePlus, X, Loader2, Camera } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { compressImage, formatFileSize } from "@/lib/utils/image-compress";
import { MAX_PHOTOS_PER_ASSET } from "@/types/asset-photo";

// Foto yang dikelola di komponen (belum tentu tersimpan di server).
// - punya id (dari db) → foto lama tersimpan
// - punya blob (hasil kompres) → foto baru menunggu diupload saat simpan
export type PendingPhoto = {
  key: string;             // key unik lokal
  id?: string;             // id db bila foto lama
  previewUrl: string;      // untuk <img>
  blob?: Blob;             // ada bila foto baru
  size: number;            // byte
  mime?: string;           // tipe hasil kompresi (image/jpeg)
  ext?: string;            // ekstensi hasil kompresi (jpg)
  markedDelete?: boolean;  // foto lama yang ditandai hapus
};

export function AssetPhotoUpload({
  photos, onChange,
}: {
  photos: PendingPhoto[];
  onChange: (photos: PendingPhoto[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const visible = photos.filter((p) => !p.markedDelete);
  const canAdd = visible.length < MAX_PHOTOS_PER_ASSET;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const slotsLeft = MAX_PHOTOS_PER_ASSET - visible.length;
    if (slotsLeft <= 0) {
      toast.error(`Maksimal ${MAX_PHOTOS_PER_ASSET} foto per aset.`);
      return;
    }
    const toProcess = Array.from(files).slice(0, slotsLeft);
    setBusy(true);
    try {
      const added: PendingPhoto[] = [];
      for (const file of toProcess) {
        try {
          const result = await compressImage(file);
          added.push({
            key: crypto.randomUUID(),
            previewUrl: URL.createObjectURL(result.blob),
            blob: result.blob,
            size: result.size,
            mime: result.mime,
            ext: result.ext,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Gagal memproses foto.";
          toast.error(`${file.name}: ${msg}`);
        }
      }
      if (added.length) onChange([...photos, ...added]);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removePhoto(key: string) {
    const target = photos.find((p) => p.key === key);
    if (!target) return;
    if (target.id) {
      // foto lama → tandai hapus (dieksekusi saat simpan)
      onChange(photos.map((p) => (p.key === key ? { ...p, markedDelete: true } : p)));
    } else {
      // foto baru → buang saja
      if (target.previewUrl.startsWith("blob:")) URL.revokeObjectURL(target.previewUrl);
      onChange(photos.filter((p) => p.key !== key));
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Foto Aset</p>
        <span className="text-xs text-muted-foreground">
          {visible.length}/{MAX_PHOTOS_PER_ASSET} · dikompres otomatis
        </span>
      </div>

      <div className="flex flex-wrap gap-3">
        {visible.map((p) => (
          <div key={p.key} className="relative">
            <div className="relative h-28 w-36 overflow-hidden rounded-lg border bg-muted">
              {/* pakai img biasa: sumber blob/signed url dinamis */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.previewUrl} alt="Foto aset"
                className="h-full w-full object-cover" />
            </div>
            <div className="mt-1 flex items-center justify-between px-0.5">
              <span className="text-[11px] text-muted-foreground">
                {formatFileSize(p.size)}
                {p.blob ? " · baru" : ""}
              </span>
              <button type="button" onClick={() => removePhoto(p.key)}
                className="rounded p-0.5 text-muted-foreground hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}

        {canAdd && (
          <button type="button" onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex h-28 w-36 flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed text-muted-foreground transition hover:border-primary/50 hover:text-foreground disabled:opacity-50">
            {busy ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-xs">Mengompres…</span>
              </>
            ) : (
              <>
                <ImagePlus className="h-5 w-5" />
                <span className="text-xs">Tambah Foto</span>
              </>
            )}
          </button>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" multiple hidden
        onChange={(e) => handleFiles(e.target.files)} />

      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Camera className="h-3 w-3" />
        Foto otomatis dikompres ke JPG maks 1024×768 (±100KB) agar hemat penyimpanan.
      </p>
    </div>
  );
}
