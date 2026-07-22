import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PBMS-IT — Personal Business Management System",
    short_name: "PBMS-IT",
    description: "Manajemen bisnis IT: penjualan, stok, keuangan, client 360.",
    id: "/dashboard",
    scope: "/",
    lang: "id",
    dir: "ltr",
    start_url: "/dashboard",
    display: "standalone",
    // Disamakan dengan token --canvas supaya splash screen menyatu dengan
    // kanvas aplikasi; putih murni bikin ada "kedip" saat app dibuka.
    background_color: "#f4f7f6",
    theme_color: "#0f766e",
    orientation: "portrait-primary",
    categories: ["business", "finance", "productivity"],
    // File ikon ada di public/ (root), BUKAN public/icons/. Path lama
    // menunjuk ke /icons/... dan selalu 404, sehingga PWA terpasang dengan
    // ikon default browser. Diverifikasi: /icons/icon-192.png -> 404,
    // /icon-192.png -> 200.
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
