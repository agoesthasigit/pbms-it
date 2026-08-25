-- ============================================================================
-- PORTAL DISTRIBUTOR — Terima Pengajuan sekaligus JUAL (dropship).
-- Rencana & aturan: docs/PORTAL-DISTRIBUTOR.md (Log Revisi 2026-08-25).
--
-- Kasus nyata: Line Art mengirim barang (mis. kertas) LANGSUNG ke lokasi client
-- (Rob Peetoom Seminyak) — barang tak pernah mengendap di gudang pemilik. Saat
-- Terima, pemilik bisa memilih "langsung jual (dropship)": create_purchase LALU
-- create_sale dalam SATU transaksi (persis pola create_quick_deal, audit 3.1).
-- Qty beli = qty jual → stok bersih 0.
--
-- Prinsip yang DIJAGA (docs Prinsip #1/#2):
--   * Entri portal tetap berjangkar pada PEMBELIAN/HUTANG (Aliran 1). Kunci portal
--     = pelunasan hutang, TAK PERNAH melihat status invoice client (Aliran 2).
--   * sale_id hanya JEJAK telusur — tak pernah memicu status portal.
--   * "Terima" jalan di sesi pemilik → auth.uid()=pemilik → RPC keuangan lama utuh.
--   * Toggle "jadikan aset" & "barang aktif" = setelan KATALOG produk (kolom
--     products.track_as_asset/is_active) — sama seperti menu Stok; berlaku untuk
--     penjualan berikutnya, nota terjual tetap terkunci.
-- ============================================================================

-- 1) Jejak penjualan hasil dropship (telusur; BUKAN pemicu status portal). --------
alter table public.distributor_orders
  add column if not exists sale_id uuid references public.sales(id) on delete set null;

-- 2) RPC pemilik: Terima + Jual (dropship) dalam satu transaksi. ------------------
-- p_lines = [{ item_id, selling_price, warranty_months?, track_as_asset?, is_active? }]
--   nama/qty/modal diambil dari DB (otoritatif); harga jual/garansi/toggle dari input.
create or replace function public.accept_distributor_order_dropship(
  p_order_id       uuid,
  p_lines          jsonb,
  p_client_id      uuid,
  p_sale_method    public.payment_method default 'monthly_invoice',
  p_sale_wallet_id uuid  default null,
  p_period_month   date  default null,
  p_brand          text  default 'cetak_ide',
  p_extra_notes    text  default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_dist   uuid; v_dest text; v_odate date; v_status text;
  v_pitems jsonb; v_sitems jsonb := '[]'::jsonb;
  v_notes  text; v_due date; v_period date; v_sale_due date;
  v_purchase_id uuid; v_sale_id uuid;
  v_line   jsonb; v_it record; v_product_id uuid;
begin
  if p_client_id is null then
    raise exception 'Client wajib dipilih untuk penjualan';
  end if;

  select distributor_id, destination, order_date, status
    into v_dist, v_dest, v_odate, v_status
    from public.distributor_orders
   where id = p_order_id and owner_user_id = v_uid;
  if v_dist is null then raise exception 'Pengajuan tak ditemukan'; end if;
  if v_status <> 'draft' then raise exception 'Pengajuan sudah diproses'; end if;
  if not exists (select 1 from public.distributor_order_items where order_id = p_order_id) then
    raise exception 'Pengajuan tak punya barang';
  end if;

  -- (a) Item pembelian: nama/qty/modal dari DB; jual/garansi dari input per item_id.
  select jsonb_agg(jsonb_build_object(
           'name',  it.name,
           'qty',   it.qty,
           'price', it.cost_price,
           'selling_price',   coalesce(nullif(l->>'selling_price','')::numeric, 0),
           'warranty_months', coalesce(nullif(l->>'warranty_months','')::int, 12),
           'unit',            'pcs'))
    into v_pitems
    from public.distributor_order_items it
    left join lateral (
       select el as l from jsonb_array_elements(coalesce(p_lines,'[]'::jsonb)) el
       where (el->>'item_id')::uuid = it.id limit 1
    ) j on true
   where it.order_id = p_order_id;

  -- (b) Catatan (gabung tujuan + catatan pemilik) & jatuh tempo hutang (akhir bulan kirim).
  v_notes := 'Tujuan: ' || coalesce(nullif(btrim(v_dest),''), '-');
  if coalesce(btrim(p_extra_notes),'') <> '' then
    v_notes := v_notes || ' | ' || btrim(p_extra_notes);
  end if;
  v_due := (date_trunc('month', v_odate) + interval '1 month' - interval '1 day')::date;

  -- (c) BELI (hutang): stok masuk + hutang tercatat (auth.uid()=pemilik).
  v_purchase_id := public.create_purchase(
    v_dist, null, v_odate, null, v_notes, v_pitems, true, v_due);

  -- (d) Resolve produk tiap baris, terapkan toggle katalog, susun item jual.
  for v_it in select id, name, qty from public.distributor_order_items where order_id = p_order_id loop
    select el into v_line
      from jsonb_array_elements(coalesce(p_lines,'[]'::jsonb)) el
      where (el->>'item_id')::uuid = v_it.id limit 1;

    select id into v_product_id from public.products
      where user_id = v_uid and lower(name) = lower(v_it.name) and is_service = false
      limit 1;
    if v_product_id is null then
      raise exception 'Produk "%" tak ditemukan setelah pembelian', v_it.name;
    end if;

    -- Setelan KATALOG produk (aset & aktif) — hanya diubah bila dikirim di input.
    update public.products set
      track_as_asset = coalesce((v_line->>'track_as_asset')::boolean, track_as_asset),
      is_active      = coalesce((v_line->>'is_active')::boolean, is_active)
    where id = v_product_id and user_id = v_uid;

    v_sitems := v_sitems || jsonb_build_object(
      'product_id',      v_product_id,
      'qty',             v_it.qty,
      'price',           coalesce(nullif(v_line->>'selling_price','')::numeric, 0),
      'warranty_months', coalesce(nullif(v_line->>'warranty_months','')::int, 12));
  end loop;

  -- (e) Parameter penjualan per metode.
  if p_sale_method = 'monthly_invoice' then
    if p_period_month is null then raise exception 'Periode invoice wajib diisi'; end if;
    v_period   := date_trunc('month', p_period_month)::date;
    v_sale_due := (date_trunc('month', p_period_month) + interval '1 month' - interval '1 day')::date;
  elsif p_sale_method in ('cash','transfer') then
    if p_sale_wallet_id is null then raise exception 'Wallet penerima wajib untuk tunai/transfer'; end if;
  else
    -- terhutang (piutang): jatuh tempo = akhir bulan kirim.
    v_sale_due := v_due;
  end if;

  -- (f) JUAL: stok keluar (net 0), aset per track_as_asset, efek keuangan per metode.
  v_sale_id := public.create_sale(
    p_client_id,
    case when p_sale_method in ('cash','transfer') then p_sale_wallet_id else null end,
    v_odate, p_sale_method, v_notes, v_sitems,
    v_period, v_sale_due, p_brand);

  -- (g) Tandai order: diterima + jejak pembelian & penjualan.
  update public.distributor_orders
     set status = 'accepted', purchase_id = v_purchase_id, sale_id = v_sale_id, updated_at = now()
   where id = p_order_id and owner_user_id = v_uid;

  return jsonb_build_object('purchase_id', v_purchase_id, 'sale_id', v_sale_id);
end $$;

revoke execute on function public.accept_distributor_order_dropship(
  uuid, jsonb, uuid, public.payment_method, uuid, date, text, text) from public, anon;
grant  execute on function public.accept_distributor_order_dropship(
  uuid, jsonb, uuid, public.payment_method, uuid, date, text, text) to authenticated;
