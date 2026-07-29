// ============================================================
//  Backup database PBMS-IT (Supabase Postgres) — LOKAL saja.
//
//  Menghasilkan 2 file ber-timestamp di folder backups/:
//    - schema_<ts>.sql : struktur (tabel, view, fungsi, RLS) schema public
//    - data_<ts>.sql   : isi data schema public (bisa di-restore ke Postgres mana pun)
//
//  Jalankan:  npm run backup
//
//  Prasyarat:
//    1) pg_dump portabel ada di tools/pgsql/bin/pg_dump.exe
//       (atau set env PG_DUMP ke path pg_dump lain).
//    2) .env.local memuat SUPABASE_DB_URL = connection string Postgres.
//       Ambil dari Supabase Dashboard → Project Settings → Database →
//       Connection string → tab "Session pooler" (ramah IPv4 & mendukung pg_dump).
// ============================================================

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const root = process.cwd();

// --- Muat variabel dari .env.local (Node 20.6+/24) ---
try {
  process.loadEnvFile(resolve(root, ".env.local"));
} catch {
  // .env.local boleh tidak ada bila SUPABASE_DB_URL sudah di environment
}

const DB_URL = process.env.SUPABASE_DB_URL;
if (!DB_URL) {
  console.error(
    "\n❌ SUPABASE_DB_URL belum diset.\n" +
      "   Tambahkan baris berikut ke .env.local (password ada di string ini):\n" +
      '   SUPABASE_DB_URL="postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres"\n' +
      "   (salin dari Supabase Dashboard → Database → Connection string → Session pooler)\n",
  );
  process.exit(1);
}

// --- Lokasi pg_dump portabel ---
const isWin = process.platform === "win32";
const defaultPgDump = resolve(
  root,
  "tools",
  "pgsql",
  "bin",
  isWin ? "pg_dump.exe" : "pg_dump",
);
const PG_DUMP = process.env.PG_DUMP || defaultPgDump;

if (PG_DUMP !== "pg_dump" && !existsSync(PG_DUMP)) {
  console.error(
    `\n❌ pg_dump tidak ditemukan di:\n   ${PG_DUMP}\n` +
      "   Pastikan biner portabel sudah diekstrak, atau set env PG_DUMP.\n",
  );
  process.exit(1);
}

// --- Siapkan folder & nama file ber-timestamp ---
const backupsDir = resolve(root, "backups");
mkdirSync(backupsDir, { recursive: true });

const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(
  now.getHours(),
)}${pad(now.getMinutes())}`;

const schemaFile = resolve(backupsDir, `schema_${ts}.sql`);
const dataFile = resolve(backupsDir, `data_${ts}.sql`);

// Argumen bersama: hanya schema public, tanpa owner/privilege agar portable.
const common = [
  DB_URL,
  "--schema=public",
  "--no-owner",
  "--no-privileges",
];

function run(label, args, outFile) {
  process.stdout.write(`→ ${label} ... `);
  try {
    execFileSync(PG_DUMP, [...args, "-f", outFile], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    console.log("OK");
  } catch (err) {
    console.log("GAGAL");
    const msg = err.stderr ? err.stderr.toString() : err.message;
    console.error("\n" + msg);
    process.exit(1);
  }
}

console.log(`\nBackup PBMS-IT — ${ts}\n`);
run("Struktur (schema)", [...common, "--schema-only"], schemaFile);
run("Isi data", [...common, "--data-only"], dataFile);

console.log(`\n✅ Selesai. Tersimpan di folder backups/:`);
console.log(`   - ${schemaFile.replace(root + "\\", "").replace(root + "/", "")}`);
console.log(`   - ${dataFile.replace(root + "\\", "").replace(root + "/", "")}\n`);
console.log(
  "Untuk restore ke Postgres lain: jalankan schema_*.sql dulu, lalu data_*.sql.\n",
);
