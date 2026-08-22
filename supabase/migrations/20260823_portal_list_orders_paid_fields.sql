-- ============================================================================
-- PORTAL DISTRIBUTOR — tab "Pelunasan" (riwayat pembayaran) di portal.
-- portal_list_orders kini juga mengembalikan paid_date & invoice_no (dari
-- pembelian tertaut) agar portal bisa mengelompokkan pembayaran per tanggal.
-- Hanya field non-sensitif (tanggal bayar & no nota) — TIDAK ada wallet/kas.
-- CREATE OR REPLACE (tanda tangan sama) → ACL/grant lama (revoke PUBLIC) tetap.
-- ============================================================================
create or replace function public.portal_list_orders(p_search text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_dist uuid; v_owner uuid; v_out jsonb;
begin
  select distributor_id, owner_user_id into v_dist, v_owner
    from public.distributor_accounts where auth_uid = auth.uid() and is_active = true;
  if v_dist is null then raise exception 'Akun portal tidak aktif'; end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.order_date desc, x.created_at desc), '[]'::jsonb)
    into v_out
  from (
    select o.id, o.order_date, o.destination, o.status, o.created_at,
           (o.purchase_id is not null and pu.paid_date is not null) as is_paid,
           pu.paid_date  as paid_date,
           pu.invoice_no as invoice_no,
           coalesce((select sum(it.qty * it.cost_price)
                       from public.distributor_order_items it where it.order_id = o.id), 0) as total,
           coalesce((select count(*)
                       from public.distributor_order_items it where it.order_id = o.id), 0) as item_count,
           coalesce((select jsonb_agg(jsonb_build_object(
                       'id', it.id, 'name', it.name, 'qty', it.qty, 'cost_price', it.cost_price)
                       order by it.name)
                       from public.distributor_order_items it where it.order_id = o.id), '[]'::jsonb) as items
    from public.distributor_orders o
    left join public.purchases pu on pu.id = o.purchase_id
    where o.distributor_id = v_dist and o.owner_user_id = v_owner
      and (
        p_search is null or btrim(p_search) = '' or
        o.destination ilike '%' || p_search || '%' or
        exists (select 1 from public.distributor_order_items it
                where it.order_id = o.id and it.name ilike '%' || p_search || '%')
      )
  ) x;

  return v_out;
end $$;

-- Higiene grant (belt-and-suspenders; ACL biasanya sudah dipertahankan).
revoke execute on function public.portal_list_orders(text) from public, anon;
grant  execute on function public.portal_list_orders(text) to authenticated;
