// Terapkan satu file migrasi SQL ke DB via pg (fallback saat psql.exe korup).
// Pakai: node scripts/apply-migration.mjs <path-ke-file.sql>
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const file = process.argv[2];
if (!file) { console.error("Usage: node scripts/apply-migration.mjs <file.sql>"); process.exit(1); }

const envRaw = fs.readFileSync(".env.local", "utf8");
const m = envRaw.match(/^SUPABASE_DB_URL=(.*)$/m);
if (!m) { console.error("SUPABASE_DB_URL tidak ditemukan di .env.local"); process.exit(1); }
const connectionString = m[1].trim().replace(/^"|"$/g, "").replace(/\r/g, "");

const sql = fs.readFileSync(path.resolve(file), "utf8");

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query("begin");
  await client.query(sql);
  await client.query("commit");
  console.log("OK migrasi diterapkan:", file);
} catch (e) {
  try { await client.query("rollback"); } catch {}
  console.error("GAGAL:", JSON.stringify({ message: e.message, code: e.code, detail: e.detail, where: e.where, position: e.position }, null, 2));
  process.exitCode = 1;
} finally {
  await client.end();
}
