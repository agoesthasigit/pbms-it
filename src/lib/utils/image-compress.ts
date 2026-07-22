// ============================================================
// Kompresi foto di BROWSER sebelum upload.
//
// FORMAT: JPEG — dipilih karena:
//   1. Didukung SEMUA browser untuk encoding canvas, termasuk Safari/iPhone.
//      (Safari tidak bisa membuat WebP; permintaan WebP diam-diam jadi PNG
//       yang justru besar karena PNG mengabaikan parameter kualitas.)
//   2. @react-pdf/renderer hanya bisa merender JPG/PNG — WebP tidak muncul
//      di PDF laporan aset.
//
// TARGET: maksimal 1024x768, ukuran <= 100KB (dijamin bertingkat:
//         turunkan kualitas dulu, kalau masih besar turunkan resolusi).
// ============================================================

const TARGET_W = 1024;
const TARGET_H = 768;
const MAX_BYTES = 100 * 1024; // 100 KB

export const OUTPUT_MIME = "image/jpeg";
export const OUTPUT_EXT = "jpg";

// tingkat kualitas dicoba berurutan (JPEG menghormati nilai ini)
const QUALITY_STEPS = [0.82, 0.72, 0.62, 0.52, 0.42];
// bila pada kualitas terendah masih > target, resolusi ikut diturunkan
const SCALE_STEPS = [1, 0.8, 0.65, 0.5, 0.4];

export type CompressedImage = {
  blob: Blob;
  size: number;      // byte
  width: number;
  height: number;
  quality: number;   // kualitas final yang dipakai
  mime: string;      // selalu image/jpeg
  ext: string;       // selalu jpg
};

// Muat File menjadi HTMLImageElement
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Format foto tidak didukung browser ini. Coba foto lain atau simpan sebagai JPG."));
    };
    img.src = url;
  });
}

// Gambar ke canvas mode "cover" (isi penuh, kelebihan dipotong)
function drawCover(img: HTMLImageElement, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas tidak didukung browser ini.");

  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  const dx = (w - dw) / 2;
  const dy = (h - dh) / 2;

  // latar putih: JPEG tidak punya transparansi
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, dx, dy, dw, dh);
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Gagal memproses gambar."))),
      OUTPUT_MIME,
      quality
    );
  });
}

export async function compressImage(file: File): Promise<CompressedImage> {
  // validasi tipe (tipe kosong tetap dicoba — beberapa foto HP tidak melaporkan tipe)
  if (file.type && !file.type.startsWith("image/")) {
    throw new Error("File harus berupa gambar.");
  }

  const img = await loadImage(file);

  // hasil terkecil yang pernah didapat, sebagai cadangan bila target tak tercapai
  let best: CompressedImage | null = null;

  for (const scale of SCALE_STEPS) {
    const w = Math.round(TARGET_W * scale);
    const h = Math.round(TARGET_H * scale);
    const canvas = drawCover(img, w, h);

    for (const quality of QUALITY_STEPS) {
      const blob = await toBlob(canvas, quality);
      const candidate: CompressedImage = {
        blob,
        size: blob.size,
        width: w,
        height: h,
        quality,
        mime: OUTPUT_MIME,
        ext: OUTPUT_EXT,
      };

      // target tercapai → langsung pakai
      if (blob.size <= MAX_BYTES) return candidate;

      // simpan yang paling kecil sejauh ini
      if (!best || blob.size < best.size) best = candidate;
    }
  }

  // sangat jarang terjadi (foto ekstrem); kembalikan hasil terkecil
  if (!best) throw new Error("Gagal mengompres foto.");
  return best;
}

/**
 * @deprecated Nama lama dari masa format WebP. Dipertahankan agar impor lama
 * tidak membuat build gagal. Gunakan `compressImage`.
 */
export const compressToWebp = compressImage;

// Format ukuran byte → "78 KB" / "1,2 MB"
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
