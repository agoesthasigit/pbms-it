import { test, expect } from "@playwright/test";

// ============================================================
//  SMOKE TEST semua menu: login (dari auth.setup) → buka tiap halaman →
//  pastikan (a) tidak dilempar balik ke /login, (b) ada <h1> yang tampil
//  (PageHeader). Bila sebuah query gagal (mis. embed ambigu), `unwrap` di
//  page.tsx MELEMPAR → Next merender halaman error tanpa <h1> → test MERAH.
//  Inilah yang akan menangkap "menu hilang/kosong senyap" seperti bug
//  daftar Pembelian 2026-08-22.
// ============================================================

// Semua route menu utama (route dinamis [id] dilewati — butuh id spesifik).
const ROUTES: string[] = [
  "/dashboard",
  "/wallets",
  "/products",
  "/purchases",
  "/sales",
  "/invoices",
  "/clients",
  "/distributors",
  "/assets",
  "/maintenance",
  "/maintenance/issue",
  "/expenses",
  "/expenses/operational",
  "/expenses/personal",
  "/piutang",
  "/rab",
  "/rab/new",
  "/reports",
  "/transactions",
  "/network",
  "/cctv",
  "/settings",
  "/data-check",
];

for (const route of ROUTES) {
  test(`halaman ${route} render tanpa error`, async ({ page }) => {
    await page.goto(route, { waitUntil: "domcontentloaded" });

    // Tidak boleh terlempar ke /login (berarti sesi valid).
    await expect(page).not.toHaveURL(/\/login/);
    expect(page.url()).toContain(route);

    // Halaman normal selalu punya <h1> (PageHeader). Bila server component
    // melempar (mis. query gagal), Next render error page → <h1> tak ada.
    await expect(page.locator("h1").first()).toBeVisible();
  });
}

// Validasi DATA lewat tampilan: halaman Pemeriksaan Data harus melaporkan
// "Data sehat" (semua cek lolos). Bila ada anomali, test gagal & menunjuknya —
// sesuai permintaan agar pengecekan data ikut di halaman periksa data.
test("Pemeriksaan Data melaporkan Data sehat", async ({ page }) => {
  await page.goto("/data-check", { waitUntil: "domcontentloaded" });

  // Tunggu pemeriksaan selesai (muncul salah satu: sehat / ada masalah / error).
  const healthy = page.getByText("Data sehat");
  const problem = page.getByText(/pemeriksaan menemukan masalah/);
  const failed = page.getByText(/Gagal menjalankan pemeriksaan/);
  await expect(healthy.or(problem).or(failed)).toBeVisible({ timeout: 30_000 });

  // RPC tidak boleh error, dan hasilnya harus sehat.
  await expect(failed).toHaveCount(0);
  await expect(healthy).toBeVisible();
});
