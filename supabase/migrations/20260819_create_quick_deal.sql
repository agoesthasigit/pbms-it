-- ============================================================
-- Transaksi Cepat (Beli & Jual Sekaligus) — audit Tahap 3, temuan 3.1.
--
-- Untuk pola reseller "beli barang lalu langsung jual ke client tertentu"
-- (mis. beli printer 1jt, jual 2jt) yang biasanya butuh 2 menu. RPC ini
-- menjalankan create_purchase LALU create_sale dalam SATU transaksi atomik —
-- kalau penjualan gagal, pembelian ikut dibatalkan (rollback), sehingga tak
-- pernah ada stok/kas yang setengah jadi.
--
-- Reuse fungsi yang sudah terbukti: stok masuk/keluar, aset client, efek
-- wallet, dan penggabungan invoice bulanan semuanya identik dengan alur biasa.
--
-- p_items: [{ name, qty, buy_price, sell_price, warranty_months }]
--   qty dipakai sama untuk beli & jual (beli N → jual N; stok bersih 0).
-- ============================================================

create or replace function public.create_quick_deal(
  p_distributor_id uuid,
  p_buy_wallet_id  uuid,
  p_deal_date      date,
  p_invoice_no     text,
  p_client_id      uuid,
  p_sale_method    public.payment_method,
  p_sale_wallet_id uuid,
  p_notes          text,
  p_items          jsonb,
  p_period_month   date default null,
  p_due_date       date default null
) returns jsonb
  language plpgsql
  security definer
  as $$
declare
  v_uid uuid := auth.uid();
  v_purchase_id uuid;
  v_sale_id uuid;
  v_item jsonb;
  v_name text;
  v_qty int;
  v_product_id uuid;
  v_purchase_items jsonb := '[]'::jsonb;
  v_sale_items jsonb := '[]'::jsonb;
begin
  if jsonb_array_length(p_items) = 0 then
    raise exception 'Minimal 1 barang harus diisi';
  end if;

  -- 1) Susun item pembelian: harga beli + set harga jual default & garansi produk.
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_name := trim(v_item->>'name');
    v_qty  := (v_item->>'qty')::int;
    if v_name is null or v_name = '' then
      raise exception 'Nama barang tidak boleh kosong';
    end if;
    if v_qty <= 0 then
      raise exception 'Qty "%" harus lebih dari 0', v_name;
    end if;
    v_purchase_items := v_purchase_items || jsonb_build_object(
      'name', v_name,
      'qty', v_qty,
      'price', (v_item->>'buy_price')::numeric,
      'selling_price', v_item->>'sell_price',
      'warranty_months', v_item->>'warranty_months'
    );
  end loop;

  -- 2) BELI: buat/gabung produk, stok masuk, wallet keluar.
  v_purchase_id := create_purchase(
    p_distributor_id, p_buy_wallet_id, p_deal_date, p_invoice_no, p_notes, v_purchase_items);

  -- 3) Resolve product_id tiap item (produk yang baru dibeli) → susun item jual.
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_name := trim(v_item->>'name');
    select id into v_product_id
      from products
      where user_id = v_uid and lower(name) = lower(v_name) and is_service = false
      limit 1;
    if v_product_id is null then
      raise exception 'Produk "%" tidak ditemukan setelah pembelian', v_name;
    end if;
    v_sale_items := v_sale_items || jsonb_build_object(
      'product_id', v_product_id,
      'qty', (v_item->>'qty')::int,
      'price', (v_item->>'sell_price')::numeric,
      'warranty_months', coalesce(nullif(v_item->>'warranty_months','')::int, 12)
    );
  end loop;

  -- 4) JUAL: stok keluar (memakai stok yang baru masuk), aset client, efek
  --    keuangan / gabung invoice bulanan — semua lewat create_sale.
  v_sale_id := create_sale(
    p_client_id, p_sale_wallet_id, p_deal_date, p_sale_method, p_notes,
    v_sale_items, p_period_month, p_due_date);

  return jsonb_build_object('purchase_id', v_purchase_id, 'sale_id', v_sale_id);
end $$;

-- Hanya user login (authenticated) yang boleh membuat transaksi; cabut dari anon.
-- (Supabase memberi EXECUTE ke anon & authenticated lewat default privileges.)
revoke execute on function public.create_quick_deal(uuid,uuid,date,text,uuid,public.payment_method,uuid,text,jsonb,date,date) from anon;
grant  execute on function public.create_quick_deal(uuid,uuid,date,text,uuid,public.payment_method,uuid,text,jsonb,date,date) to authenticated;
