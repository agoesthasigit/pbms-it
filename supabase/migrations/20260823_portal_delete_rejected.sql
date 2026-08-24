-- ============================================================================
-- PORTAL DISTRIBUTOR — izinkan distributor menghapus pengajuannya yang DITOLAK.
-- Sebelumnya portal_delete_order hanya boleh menghapus status 'draft', sehingga
-- pengajuan 'rejected' menggantung di tab Arsip. Kini boleh hapus 'draft' ATAU
-- 'rejected' — keduanya TAK punya pembelian (purchase_id null) → nol dampak
-- keuangan (beda dg 'accepted' yang terikat stok/hutang, tetap TERKUNCI).
-- Guard tambahan `purchase_id is null` sbg pengaman. CREATE OR REPLACE → ACL tetap.
-- ============================================================================
create or replace function public.portal_delete_order(p_order_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_dist uuid; v_owner uuid;
begin
  select distributor_id, owner_user_id into v_dist, v_owner
    from public.distributor_accounts where auth_uid = auth.uid() and is_active = true;
  if v_dist is null then raise exception 'Akun portal tidak aktif'; end if;

  if not exists (select 1 from public.distributor_orders
                 where id = p_order_id and distributor_id = v_dist
                   and owner_user_id = v_owner
                   and status in ('draft','rejected')
                   and purchase_id is null) then
    raise exception 'Pengajuan tak ditemukan atau tak bisa dihapus (hanya draft/ditolak)';
  end if;
  delete from public.distributor_orders where id = p_order_id; -- items cascade
end $$;

revoke execute on function public.portal_delete_order(uuid) from public, anon;
grant  execute on function public.portal_delete_order(uuid) to authenticated;
