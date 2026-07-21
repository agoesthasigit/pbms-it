// ============================================================
// Kompresi foto di BROWSER sebelum upload.
// Target: WebP, 1024x768 (cover), ukuran <= ~100KB.
// Strategi: resize ke 1024x768, lalu turunkan kualitas bertahap
// sampai file <= target. Foto sangat detail bisa sedikit di atas
// target pada kualitas minimum — itu batas wajar.
// ============================================================

const TARGET_W = 1024;
const TARGET_H = 768;
const MAX_BYTES = 100 * 1024; // 100 KB
const MIN_QUALITY = 0.4;      // batas bawah kualitas (jaga agar tak terlalu pecah)

export type CompressedImage = {
  blob: Blob;
  size: number;       // byte
  width: number;
  height: number;
  quality: number;    // kualitas final yang dipakai
};

// Muat File menjadi HTMLImageElement
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Gagal memuat gambar.")); };
    img.src = url;
  });
}

// Gambar ke canvas dengan mode "cover" (isi penuh 1024x768, crop kelebihan)
function drawCover(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = TARGET_W;
  canvas.height = TARGET_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas tidak didukung browser ini.");

  const scale = Math.max(TARGET_W / img.width, TARGET_H / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  const dx = (TARGET_W - w) / 2;
  const dy = (TARGET_H - h) / 2;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, TARGET_W, TARGET_H);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, dx, dy, w, h);
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Gagal mengonversi gambar."))),
      "image/webp",
      quality
    );
  });
}

export async function compressToWebp(file: File): Promise<CompressedImage> {
  // validasi tipe
  if (!file.type.startsWith("image/")) {
    throw new Error("File harus berupa gambar.");
  }

  const img = await loadImage(file);
  const canvas = drawCover(img);

  // turunkan kualitas bertahap sampai <= target atau mentok minimum
  let quality = 0.82;
  let blob = await toBlob(canvas, quality);
  while (blob.size > MAX_BYTES && quality > MIN_QUALITY) {
    quality = Math.max(MIN_QUALITY, quality - 0.1);
    blob = await toBlob(canvas, quality);
  }

  return {
    blob,
    size: blob.size,
    width: TARGET_W,
    height: TARGET_H,
    quality: Math.round(quality * 100) / 100,
  };
}

// Format ukuran byte → "78 KB" / "1,2 MB"
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
