import { defineConfig, devices } from "@playwright/test";

// ============================================================
//  Konfigurasi E2E smoke test (Playwright).
//
//  Tujuan: menangkap "menu rusak/hilang" seperti bug daftar Pembelian kosong —
//  login sekali lalu buka SEMUA menu & pastikan tiap halaman render (ada <h1>),
//  plus halaman Pemeriksaan Data melaporkan "Data sehat".
//
//  Kredensial akun test dibaca dari .env.local (TIDAK di-hardcode / commit):
//    E2E_TEST_EMAIL, E2E_TEST_PASSWORD
//  Jalankan:  npm run test:e2e   (server dev dinyalakan otomatis)
// ============================================================

// Muat E2E_TEST_* (dan env lain) dari .env.local untuk test runner.
try {
  process.loadEnvFile(".env.local");
} catch {
  // boleh tak ada bila env sudah tersedia di environment
}

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE,
    navigationTimeout: 60_000,
    trace: "on-first-retry",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "smoke",
      dependencies: ["setup"],
      testMatch: /.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/state.json" },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
