"use client";

import { useEffect, useState } from "react";

// Deteksi lebar mobile (< lg / 1024px). Mengembalikan `undefined` sebelum
// ter-mount agar render server & render awal klien identik (hindari hydration
// mismatch). Dipakai untuk hal yang harus benar-benar TIDAK di-mount di
// mobile (mis. grafik Recharts yang error saat kontainernya display:none).
export function useIsMobile(): boolean | undefined {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}
