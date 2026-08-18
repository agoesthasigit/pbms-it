-- ============================================================
-- Pengerasan keamanan (hasil Audit Tahap 2 — 2026-08-18).
--
-- 2.1 KRITIS: 9 view memakai security_invoker=off → berjalan sebagai
--     pemilik (postgres) sehingga MEM-BYPASS RLS tabel dasar, dan
--     ter-GRANT SELECT ke role anon/authenticated tanpa memfilter
--     auth.uid(). Akibatnya data (saldo wallet, invoice, aset client,
--     metadata kredensial) bisa dibaca lewat REST Supabase MEMAKAI ANON
--     KEY PUBLIK TANPA LOGIN.
--     Perbaikan: set security_invoker=on → view menghormati RLS penanya.
--     Anon (tanpa sesi) → 0 baris; authenticated → hanya baris miliknya.
--     Aplikasi tetap jalan (semua akses lewat sesi login). PG 17.6 mendukung.
--
-- 2.2: helper pgcrypto encrypt_secret/decrypt_secret (SECURITY DEFINER,
--     owner postgres) ter-EXECUTE-grant ke anon/authenticated dan tak
--     mengecek auth.uid() → decrypt_secret bisa dipanggil siapa pun.
--     Perbaikan: cabut EXECUTE dari anon/authenticated/public. Pemanggil
--     resmi (reveal_*/save_*/upsert_*) semuanya SECURITY DEFINER milik
--     postgres → tetap bisa memanggil helper (tak ada fitur yang rusak).
-- ============================================================

-- ---------- 2.1 View menghormati RLS penanya ----------
alter view public.v_wallet_balances       set (security_invoker = on);
alter view public.v_monthly_invoices       set (security_invoker = on);
alter view public.v_client_assets          set (security_invoker = on);
alter view public.v_network_credentials    set (security_invoker = on);
alter view public.v_cctv_systems           set (security_invoker = on);
alter view public.v_maintenance_contracts  set (security_invoker = on);
alter view public.v_rab_summary            set (security_invoker = on);
alter view public.v_product_stock          set (security_invoker = on);
alter view public.v_products_in_stock      set (security_invoker = on);

-- ---------- 2.2 Cabut akses helper kripto dari role publik ----------
revoke execute on function public.encrypt_secret(text, text)  from anon, authenticated, public;
revoke execute on function public.decrypt_secret(bytea, text) from anon, authenticated, public;
