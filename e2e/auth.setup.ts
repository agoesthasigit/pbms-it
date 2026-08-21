import { test as setup, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

// Login sekali di awal, simpan sesi (cookies) ke file → dipakai ulang semua
// smoke test (tak perlu login berulang). File sesi TIDAK di-commit.
const AUTH_FILE = path.join("e2e", ".auth", "state.json");

setup("login akun test", async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "E2E_TEST_EMAIL / E2E_TEST_PASSWORD belum diset di .env.local. " +
        "Isi kredensial AKUN TEST khusus (bukan akun utama) lebih dulu.",
    );
  }

  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: "Masuk" }).click();

  // Login sukses → middleware mengarahkan ke /dashboard.
  await page.waitForURL("**/dashboard", { timeout: 30_000 });
  await expect(page.locator("h1")).toBeVisible();

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await page.context().storageState({ path: AUTH_FILE });
});
