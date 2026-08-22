-- ============================================================================
-- PORTAL DISTRIBUTOR — Phase 5 (audit): tutup temuan grant.
-- Temuan: `anon` masih ber-EXECUTE ke RPC portal/admin karena CREATE FUNCTION
-- memberi EXECUTE ke PUBLIC secara default, dan `revoke ... from anon` di migrasi
-- Phase 0 TIDAK mencabut grant PUBLIC (anon anggota PUBLIC → tetap punya akses).
-- Dampak aktual nihil (semua RPC discope auth.uid() yang null utk anon), tapi
-- higiene keamanan: cabut dari PUBLIC & anon, sisakan hanya authenticated.
-- ============================================================================
revoke execute on function public.portal_my_context()                       from public, anon;
revoke execute on function public.portal_list_orders(text)                   from public, anon;
revoke execute on function public.portal_upsert_order(uuid,date,text,jsonb)  from public, anon;
revoke execute on function public.portal_delete_order(uuid)                  from public, anon;
revoke execute on function public.accept_distributor_order(uuid,jsonb,text)  from public, anon;
revoke execute on function public.unaccept_distributor_order(uuid)           from public, anon;
revoke execute on function public.reject_distributor_order(uuid)             from public, anon;

grant execute on function public.portal_my_context()                       to authenticated;
grant execute on function public.portal_list_orders(text)                   to authenticated;
grant execute on function public.portal_upsert_order(uuid,date,text,jsonb)  to authenticated;
grant execute on function public.portal_delete_order(uuid)                  to authenticated;
grant execute on function public.accept_distributor_order(uuid,jsonb,text)  to authenticated;
grant execute on function public.unaccept_distributor_order(uuid)           to authenticated;
grant execute on function public.reject_distributor_order(uuid)             to authenticated;
