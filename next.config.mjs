import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development", // aktif hanya di production
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Serwist menambahkan konfigurasi `webpack`. Di Next 16 Turbopack aktif
  // secara default, dan adanya webpack config tanpa turbopack config memicu
  // ERROR yang memblokir dev server. `turbopack` kosong menandakan ini disengaja.
  turbopack: {
    root: import.meta.dirname,
  },

  // Jaring pengaman upload foto aset. Bawaan Next hanya 1MB per Server Action.
  // Foto sudah dikompres ke ±100KB di browser, jadi ini hanya cadangan
  // agar tidak pernah lagi gagal diam-diam.
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
};

export default withSerwist(nextConfig);