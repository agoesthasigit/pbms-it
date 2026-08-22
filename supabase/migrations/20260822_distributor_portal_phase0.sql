-- ============================================================================
-- PORTAL DISTRIBUTOR — Phase 0: Fondasi DB & keamanan
-- Rencana lengkap: docs/PORTAL-DISTRIBUTOR.md
--
-- Portal pertama: "Line Art by Cino" (pemasok, beli-tempo). Line Art menginput
-- pengajuan (staging) → pemilik "Terima" (isi harga jual) → create_purchase
-- (is_credit=true) jalan di sesi PEMILIK → stok + hutang. Distributor terisolasi:
-- HANYA menyentuh distributor_orders* lewat RPC portal (SECURITY DEFINER), tak
-- pernah baca wallet/client/sales/harga jual.
--
-- Prinsip (jangan dilanggar):
--  * 1 entri portal = 1 PEMBELIAN (bukan penjualan).
--  * Kunci portal dijangkar ke pelunasan HUTANG ke distributor, LEPAS dari status
--    invoice client (batal-lunas client tak berpengaruh).
--  * "Terima" selalu di sesi pemilik → auth.uid()=pemilik → RPC keuangan lama utuh.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) TABEL
-- ---------------------------------------------------------------------------

-- 1a. Pemetaan akun login portal → distributor → pemilik. Di-seed manual sekali
--     per distributor (akun Auth dibuat di dashboard Supabase; tanpa service role).
create table if not exists public.distributor_accounts (
  auth_uid       uuid primary key references auth.users(id) on delete cascade,
  distributor_id uuid not null references public.distributors(id) on delete cascade,
  owner_user_id  uuid not null references auth.users(id) on delete cascade,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);
create index if not exists distributor_accounts_owner_idx on public.distributor_accounts(owner_user_id);

-- 1b. Pengajuan (meja antara). Draft = di luar buku keuangan (nol dampak).
create table if not exists public.distributor_orders (
  id             uuid primary key default gen_random_uuid(),
  owner_user_id  uuid not null references auth.users(id) on delete cascade,
  distributor_id uuid not null references public.distributors(id) on delete cascade,
  submitted_by   uuid references auth.users(id),
  order_date     date not null default current_date,      -- tanggal kirim (nota jujur)
  destination    text,                                     -- teks bebas tujuan (privasi client)
  status         text not null default 'draft'
                   check (status in ('draft','accepted','rejected')),
  purchase_id    uuid references public.purchases(id) on delete set null, -- terisi saat Terima
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists distributor_orders_owner_status_idx on public.distributor_orders(owner_user_id, status);
create index if not exists distributor_orders_submitted_idx    on public.distributor_orders(submitted_by);

-- 1c. Baris barang pengajuan. HARGA JUAL TIDAK di sini (milik pemilik saat Terima).
create table if not exists public.distributor_order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.distributor_orders(id) on delete cascade,
  name       text not null,
  qty        int  not null check (qty > 0),
  cost_price numeric(15,2) not null default 0
);
create index if not exists distributor_order_items_order_idx on public.distributor_order_items(order_id);

-- ---------------------------------------------------------------------------
-- 2) RLS — akses langsung tabel HANYA untuk pemilik. Distributor tak punya policy
--    apa pun di sini (akses via RPC SECURITY DEFINER yang menyaring per uid).
-- ---------------------------------------------------------------------------
alter table public.distributor_accounts    enable row level security;
alter table public.distributor_orders      enable row level security;
alter table public.distributor_order_items enable row level security;

drop policy if exists distributor_accounts_owner on public.distributor_accounts;
create policy distributor_accounts_owner on public.distributor_accounts
  for all using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);

drop policy if exists distributor_orders_owner on public.distributor_orders;
create policy distributor_orders_owner on public.distributor_orders
  for all using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);

drop policy if exists distributor_order_items_owner on public.distributor_order_items;
create policy distributor_order_items_owner on public.distributor_order_items
  for all using (
    exists (select 1 from public.distributor_orders o
            where o.id = order_id and o.owner_user_id = auth.uid()))
  with check (
    exists (select 1 from public.distributor_orders o
            where o.id = order_id and o.owner_user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 3) RPC SISI DISTRIBUTOR (portal). auth.uid() = distributor. Semua menyaring
--    lewat distributor_accounts; menulis owner_user_id/distributor_id dari
--    pemetaan (BUKAN dari input klien). Hanya draft yang bisa diubah/hapus.
-- ---------------------------------------------------------------------------

-- Konteks akun portal pemanggil (dipakai UI portal untuk tahu identitas).
create or replace function public.portal_my_context()
returns table(distributor_id uuid, distributor_name text, owner_user_id uuid)
language sql security definer set search_path = public
as $$
  select da.distributor_id, d.name, da.owner_user_id
  from public.distributor_accounts da
  join public.distributors d on d.id = da.distributor_id
  where da.auth_uid = auth.uid() and da.is_active = true;
$$;

-- Daftar pengajuan milik distributor pemanggil (+ search), dengan item ter-nested,
-- total, jumlah item, dan status hutang (paid) untuk yang sudah Diterima.
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

-- Buat/ubah DRAFT. p_order_id null = buat baru. p_items = [{name, qty, cost_price}].
create or replace function public.portal_upsert_order(
  p_order_id uuid, p_order_date date, p_destination text, p_items jsonb
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_dist uuid; v_owner uuid; v_id uuid; v_item jsonb;
  v_name text; v_qty int; v_cost numeric;
begin
  select distributor_id, owner_user_id into v_dist, v_owner
    from public.distributor_accounts where auth_uid = auth.uid() and is_active = true;
  if v_dist is null then raise exception 'Akun portal tidak aktif'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Minimal 1 barang harus diisi';
  end if;

  if p_order_id is null then
    insert into public.distributor_orders(owner_user_id, distributor_id, submitted_by,
                                          order_date, destination, status)
    values (v_owner, v_dist, auth.uid(),
            coalesce(p_order_date, current_date), nullif(btrim(p_destination),''), 'draft')
    returning id into v_id;
  else
    -- Wajib milik distributor ini & masih draft.
    select id into v_id from public.distributor_orders
      where id = p_order_id and distributor_id = v_dist and owner_user_id = v_owner
        and status = 'draft';
    if v_id is null then
      raise exception 'Pengajuan tak ditemukan atau sudah diproses (tak bisa diubah)';
    end if;
    update public.distributor_orders
       set order_date  = coalesce(p_order_date, order_date),
           destination = nullif(btrim(p_destination),''),
           updated_at  = now()
     where id = v_id;
    delete from public.distributor_order_items where order_id = v_id;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_name := btrim(v_item->>'name');
    v_qty  := coalesce((v_item->>'qty')::int, 0);
    v_cost := coalesce(nullif(v_item->>'cost_price','')::numeric, 0);
    if v_name = '' then raise exception 'Nama barang tidak boleh kosong'; end if;
    if v_qty <= 0 then raise exception 'Qty harus lebih dari 0'; end if;
    insert into public.distributor_order_items(order_id, name, qty, cost_price)
    values (v_id, v_name, v_qty, v_cost);
  end loop;

  return v_id;
end $$;

-- Hapus DRAFT milik sendiri.
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
                   and owner_user_id = v_owner and status = 'draft') then
    raise exception 'Pengajuan tak ditemukan atau sudah diproses (tak bisa dihapus)';
  end if;
  delete from public.distributor_orders where id = p_order_id; -- items cascade
end $$;

-- ---------------------------------------------------------------------------
-- 4) RPC SISI PEMILIK. auth.uid() = pemilik. Terima memanggil create_purchase
--    (is_credit=true) di sesi pemilik → RPC keuangan lama tak berubah.
-- ---------------------------------------------------------------------------

-- Terima draft → jadi pembelian hutang. p_lines = [{item_id, selling_price,
-- warranty_months?, unit?}] (harga jual per baris; qty/nama/modal diambil dari DB
-- = otoritatif). Tujuan disalin+digabung ke purchases.notes.
create or replace function public.accept_distributor_order(
  p_order_id uuid, p_lines jsonb, p_extra_notes text default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_dist uuid; v_dest text; v_odate date; v_status text;
  v_items jsonb; v_notes text; v_due date; v_purchase_id uuid;
begin
  select distributor_id, destination, order_date, status
    into v_dist, v_dest, v_odate, v_status
    from public.distributor_orders
   where id = p_order_id and owner_user_id = v_uid;
  if v_dist is null then raise exception 'Pengajuan tak ditemukan'; end if;
  if v_status <> 'draft' then raise exception 'Pengajuan sudah diproses'; end if;
  if not exists (select 1 from public.distributor_order_items where order_id = p_order_id) then
    raise exception 'Pengajuan tak punya barang';
  end if;

  -- Bangun items untuk create_purchase: nama/qty/modal dari DB; harga jual/garansi/
  -- unit dari input (dicocokkan per item_id).
  select jsonb_agg(jsonb_build_object(
           'name', it.name,
           'qty',  it.qty,
           'price', it.cost_price,
           'selling_price',   coalesce(nullif(l->>'selling_price','')::numeric, 0),
           'warranty_months', coalesce(nullif(l->>'warranty_months','')::int, 12),
           'unit',            coalesce(nullif(l->>'unit',''), 'pcs')
         ))
    into v_items
    from public.distributor_order_items it
    left join lateral (
       select el as l from jsonb_array_elements(coalesce(p_lines,'[]'::jsonb)) el
       where (el->>'item_id')::uuid = it.id
       limit 1
    ) j on true
   where it.order_id = p_order_id;

  -- Catatan: gabung tujuan + catatan pemilik.
  v_notes := 'Tujuan: ' || coalesce(nullif(btrim(v_dest),''), '-');
  if coalesce(btrim(p_extra_notes),'') <> '' then
    v_notes := v_notes || ' | ' || btrim(p_extra_notes);
  end if;

  -- Jatuh tempo = akhir bulan tanggal kirim.
  v_due := (date_trunc('month', v_odate) + interval '1 month' - interval '1 day')::date;

  -- create_purchase jalan atas nama pemilik (auth.uid()=pemilik): stok + hutang.
  v_purchase_id := public.create_purchase(
    v_dist, null, v_odate, null, v_notes, v_items, true, v_due
  );

  update public.distributor_orders
     set status = 'accepted', purchase_id = v_purchase_id, updated_at = now()
   where id = p_order_id and owner_user_id = v_uid;

  return v_purchase_id;
end $$;

-- Batal Terima → balik ke DRAFT. Membalik pembelian via delete_purchase (guard
-- stok: tolak bila sudah terjual) + guard tambahan: hutang BELUM dibayar.
create or replace function public.unaccept_distributor_order(p_order_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status text; v_purchase_id uuid; v_paid date;
begin
  select status, purchase_id into v_status, v_purchase_id
    from public.distributor_orders
   where id = p_order_id and owner_user_id = v_uid;
  if v_status is null then raise exception 'Pengajuan tak ditemukan'; end if;
  if v_status <> 'accepted' or v_purchase_id is null then
    raise exception 'Hanya pengajuan yang sudah Diterima yang bisa dibatalkan';
  end if;

  select paid_date into v_paid from public.purchases
    where id = v_purchase_id and user_id = v_uid;
  if v_paid is not null then
    raise exception 'Hutang pembelian ini sudah dibayar — tak bisa Batal Terima';
  end if;

  -- Membalik stok + nota (delete_purchase menolak bila sebagian sudah terjual).
  perform public.delete_purchase(v_purchase_id);

  update public.distributor_orders
     set status = 'draft', purchase_id = null, updated_at = now()
   where id = p_order_id and owner_user_id = v_uid;
end $$;

-- Tolak draft mentah (tanpa memprosesnya).
create or replace function public.reject_distributor_order(p_order_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_status text;
begin
  select status into v_status from public.distributor_orders
    where id = p_order_id and owner_user_id = v_uid;
  if v_status is null then raise exception 'Pengajuan tak ditemukan'; end if;
  if v_status <> 'draft' then raise exception 'Hanya draft yang bisa ditolak'; end if;
  update public.distributor_orders set status = 'rejected', updated_at = now()
    where id = p_order_id and owner_user_id = v_uid;
end $$;

-- ---------------------------------------------------------------------------
-- 5) GRANTS — semua RPC ke authenticated (owner & distributor sama-sama
--    authenticated; penyaringan ada DI DALAM fungsi). Cabut dari anon.
-- ---------------------------------------------------------------------------
revoke execute on function public.portal_my_context()               from anon;
revoke execute on function public.portal_list_orders(text)          from anon;
revoke execute on function public.portal_upsert_order(uuid,date,text,jsonb) from anon;
revoke execute on function public.portal_delete_order(uuid)         from anon;
revoke execute on function public.accept_distributor_order(uuid,jsonb,text) from anon;
revoke execute on function public.unaccept_distributor_order(uuid)  from anon;
revoke execute on function public.reject_distributor_order(uuid)    from anon;

grant execute on function public.portal_my_context()               to authenticated;
grant execute on function public.portal_list_orders(text)          to authenticated;
grant execute on function public.portal_upsert_order(uuid,date,text,jsonb) to authenticated;
grant execute on function public.portal_delete_order(uuid)         to authenticated;
grant execute on function public.accept_distributor_order(uuid,jsonb,text) to authenticated;
grant execute on function public.unaccept_distributor_order(uuid)  to authenticated;
grant execute on function public.reject_distributor_order(uuid)    to authenticated;
