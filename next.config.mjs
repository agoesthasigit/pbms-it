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
};

export default withSerwist(nextConfig);
