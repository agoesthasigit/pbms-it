import fs from 'node:fs';
import pg from 'pg';
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/^SUPABASE_DB_URL=(.*)$/m)[1].trim().replace(/^"|"$/g, '').replace(/\r/g, '');
const sql = fs.readFileSync('supabase/migrations/20260819_create_quick_deal.sql', 'utf8');
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  await c.query('begin'); await c.query(sql); await c.query('commit');
  console.log('APPLIED OK');
} catch (e) { await c.query('rollback'); console.error('ROLLBACK:', e.message); process.exitCode = 1; await c.end(); process.exit(1); }
// verify exists + grants
let r = await c.query(`select pg_get_function_identity_arguments('public.create_quick_deal'::regproc) as args`);
console.log('args:', r.rows[0].args);
r = await c.query(`
  select p.grantee from information_schema.routine_grants p
  join information_schema.routines ro on ro.specific_name=p.specific_name
  where ro.routine_name='create_quick_deal' and p.privilege_type='EXECUTE'
    and p.grantee in ('anon','authenticated','PUBLIC') order by p.grantee`);
console.log('EXECUTE grantees:', r.rows.map(x=>x.grantee).join(', ') || '(none of anon/authenticated/PUBLIC)');
await c.end();
