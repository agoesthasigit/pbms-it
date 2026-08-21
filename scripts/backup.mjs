// ============================================================
//  Backup database PBMS-IT (Supabase Postgres) — LOKAL, MURNI NODE.
//
//  Tidak lagi memakai pg_dump.exe: binari portabel di mesin ini BERULANG kali
//  korup di level NTFS ("file or directory is corrupted"). Skrip ini memakai
//  paket `pg` (npm) yang sudah jadi dependency → tak ada .exe rapuh.
//
//  Menghasilkan 2 file ber-timestamp di folder backups/:
//    - schema_<ts>.sql : struktur DB = gabungan seluruh supabase/migrations/*.sql
//                        berurutan (sumber kebenaran skema; juga tersimpan di git).
//    - data_<ts>.sql   : isi data schema public sebagai perintah INSERT.
//
//  Restore ke Postgres kosong: jalankan schema_*.sql dulu, lalu data_*.sql.
//
//  Jalankan:  npm run backup
//  Prasyarat: .env.local memuat SUPABASE_DB_URL (connection string Session pooler).
// ============================================================

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import pg from "pg";

const root = process.cwd();

// --- Muat variabel dari .env.local (Node 20.6+/24) ---
try {
  process.loadEnvFile(resolve(root, ".env.local"));
} catch {
  // boleh tidak ada bila SUPABASE_DB_URL sudah di environment
}

const DB_URL = process.env.SUPABASE_DB_URL;
if (!DB_URL) {
  console.error(
    "\n❌ SUPABASE_DB_URL belum diset.\n" +
      "   Tambahkan ke .env.local (salin dari Supabase Dashboard → Database →\n" +
      '   Connection string → Session pooler):\n' +
      '   SUPABASE_DB_URL="postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres"\n',
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

const rel = (p) => p.replace(root + "\\", "").replace(root + "/", "");

// ------------------------------------------------------------
// (1) SCHEMA = gabungan seluruh migrasi berurutan.
// ------------------------------------------------------------
function writeSchema() {
  process.stdout.write("→ Struktur (schema) ... ");
  const migDir = resolve(root, "supabase", "migrations");
  if (!existsSync(migDir)) {
    console.log("DILEWATI (folder migrasi tak ada)");
    return;
  }
  const files = readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort();
  const parts = [
    "-- ============================================================",
    `-- SCHEMA PBMS-IT — gabungan ${files.length} migrasi (urut nama file).`,
    `-- Dibuat: ${now.toISOString()}`,
    "-- Restore: jalankan file ini di Postgres kosong, lalu data_*.sql.",
    "-- ============================================================",
    "",
  ];
  for (const f of files) {
    parts.push(`-- ---------- ${f} ----------`);
    parts.push(readFileSync(resolve(migDir, f), "utf8").replace(/\r\n/g, "\n").trimEnd());
    parts.push("");
  }
  writeFileSync(schemaFile, parts.join("\n"), "utf8");
  console.log("OK");
}

// ------------------------------------------------------------
// (2) DATA = INSERT per tabel. Semua kolom di-cast ke text supaya aman untuk
//     semua tipe (uuid/jsonb/bytea/timestamp/array); tujuan kolom yang menentukan
//     parsing. Kolom generated dilewati (tak boleh di-INSERT).
// ------------------------------------------------------------
function quote(v) {
  if (v === null || v === undefined) return "NULL";
  // v selalu string karena di-cast ::text di query. standard_conforming_strings=on
  // → backslash literal, cukup gandakan tanda kutip tunggal.
  return "'" + String(v).replace(/'/g, "''") + "'";
}

async function writeData(client) {
  process.stdout.write("→ Isi data ... ");

  // Tabel dasar (bukan view) di schema public.
  const { rows: tables } = await client.query(`
    select tablename
    from pg_tables
    where schemaname = 'public'
    order by tablename
  `);

  const out = [
    "-- ============================================================",
    "-- DATA PBMS-IT (schema public) — perintah INSERT.",
    `-- Dibuat: ${now.toISOString()}`,
    "-- Restore: jalankan schema_*.sql dulu (Postgres kosong), lalu file ini.",
    "-- ============================================================",
    "SET standard_conforming_strings = on;",
    "-- Nonaktifkan trigger & cek FK saat load massal (butuh hak owner/superuser).",
    "SET session_replication_role = replica;",
    "BEGIN;",
    "",
  ];

  let totalRows = 0;
  for (const { tablename } of tables) {
    // Kolom non-generated, urut ordinal. Generated (mis. subtotal) dilewati.
    const { rows: cols } = await client.query(
      `select column_name
         from information_schema.columns
        where table_schema = 'public' and table_name = $1
          and is_generated = 'NEVER'
        order by ordinal_position`,
      [tablename],
    );
    if (cols.length === 0) continue;

    const colNames = cols.map((c) => c.column_name);
    const selectList = colNames.map((c) => `"${c}"::text as "${c}"`).join(", ");
    const { rows } = await client.query(
      `select ${selectList} from public."${tablename}"`,
    );

    if (rows.length === 0) {
      out.push(`-- ${tablename}: 0 baris`);
      out.push("");
      continue;
    }

    out.push(`-- ${tablename}: ${rows.length} baris`);
    const colList = colNames.map((c) => `"${c}"`).join(", ");
    for (const r of rows) {
      const vals = colNames.map((c) => quote(r[c])).join(", ");
      out.push(`INSERT INTO public."${tablename}" (${colList}) VALUES (${vals});`);
    }
    out.push("");
    totalRows += rows.length;
  }

  out.push("COMMIT;");
  out.push("SET session_replication_role = origin;");
  writeFileSync(dataFile, out.join("\n"), "utf8");
  console.log(`OK (${totalRows} baris dari ${tables.length} tabel)`);
}

// ------------------------------------------------------------
async function main() {
  console.log(`\nBackup PBMS-IT — ${ts}\n`);

  const client = new pg.Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    writeSchema();
    await writeData(client);
  } catch (err) {
    console.log("GAGAL");
    console.error("\n" + (err?.message ?? String(err)));
    process.exitCode = 1;
    return;
  } finally {
    await client.end();
  }

  console.log(`\n✅ Selesai. Tersimpan di folder backups/:`);
  console.log(`   - ${rel(schemaFile)}`);
  console.log(`   - ${rel(dataFile)}`);
  console.log(
    "\nUntuk restore ke Postgres kosong: jalankan schema_*.sql dulu, lalu data_*.sql.\n",
  );
}

await main();
