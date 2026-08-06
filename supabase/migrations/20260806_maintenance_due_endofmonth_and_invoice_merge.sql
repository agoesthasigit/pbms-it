-- 2026-08-06
-- 1) Jatuh tempo bawaan kontrak maintenance: buka 29/30/31 + sentinel "Akhir bulan".
--    due_day = 0 berarti "akhir bulan" (tanggal terakhir bulan target, apa pun bulannya).
--    Rumus jatuh tempo di-CLAMP ke hari terakhir bulan target supaya 31 di Februari
--    tidak meleset ke bulan berikutnya.
-- 2) generate_monthly_invoice ikut MENGGABUNG ke invoice DRAFT client+periode yang
--    sudah ada (mis. tagihan maintenance terbit lebih dulu) supaya kontrak bulanan
--    dan barang jadi SATU invoice. Invoice yang sudah sent/paid TIDAK diutak-atik →
--    tetap dibuatkan invoice terpisah.

-- ---------- (1) longgarkan constraint due_day: 0..31 ----------
alter table public.maintenance_contracts
  drop constraint if exists maintenance_contracts_due_day_check;
alter table public.maintenance_contracts
  add constraint maintenance_contracts_due_day_check
  check ((due_day >= 0) and (due_day <= 31));

-- ---------- (1) issue_maintenance_charges: clamp + sentinel akhir bulan ----------
create or replace function public.issue_maintenance_charges(p_period date, p_charges jsonb)
  returns integer
  language plpgsql
  security definer
  as $$
declare
  v_uid uuid := auth.uid();
  v_row jsonb;
  v_contract_id uuid;
  v_amount numeric(15,2);
  v_client uuid;
  v_name text;
  v_due_day int;
  v_active boolean;
  v_period date := date_trunc('month', p_period)::date;
  v_sale_date date;
  v_product uuid;
  v_sale_id uuid;
  v_invoice uuid;
  v_seq int;
  v_no text;
  v_due date;
  v_next date;      -- tgl 1 bulan target (bulan berikutnya)
  v_lastday date;   -- tgl terakhir bulan target
  v_count int := 0;
begin
  if jsonb_array_length(p_charges) = 0 then
    raise exception 'Tidak ada kontrak yang dipilih';
  end if;

  v_sale_date := (v_period + interval '1 month - 1 day')::date;

  for v_row in select * from jsonb_array_elements(p_charges) loop
    v_contract_id := (v_row->>'contract_id')::uuid;
    v_amount := coalesce((v_row->>'amount')::numeric, 0);

    if v_amount <= 0 then
      raise exception 'Nominal tagihan harus lebih dari 0';
    end if;

    select client_id, service_name, due_day, is_active
      into v_client, v_name, v_due_day, v_active
      from maintenance_contracts
      where id = v_contract_id and user_id = v_uid;

    if v_client is null then
      raise exception 'Kontrak tidak ditemukan';
    end if;
    if not v_active then
      raise exception 'Kontrak "%" sudah dihentikan', v_name;
    end if;

    if exists (
      select 1 from sales
      where user_id = v_uid
        and maintenance_contract_id = v_contract_id
        and maintenance_period = v_period
    ) then
      raise exception 'Kontrak "%" sudah ditagih untuk periode ini', v_name;
    end if;

    v_product := find_or_create_service_product(v_name);

    insert into sales(user_id, client_id, wallet_id, sale_date, payment_method,
                      total, notes, maintenance_contract_id, maintenance_period)
    values (v_uid, v_client, null, v_sale_date, 'monthly_invoice',
            v_amount, null, v_contract_id, v_period)
    returning id into v_sale_id;

    insert into sale_items(user_id, sale_id, product_id, qty, price,
                           warranty_months, serial_number)
    values (v_uid, v_sale_id, v_product, 1, v_amount, 0, null);

    -- ===== HANYA invoice DRAFT yang boleh digabungi =====
    select id into v_invoice from monthly_invoices
      where user_id = v_uid
        and client_id = v_client
        and period_month = v_period
        and status = 'draft'
      order by created_at
      limit 1;

    if v_invoice is null then
      -- tidak ada draft -> buat invoice baru untuk periode ini
      -- jatuh tempo = tanggal due_day di bulan target, di-clamp ke akhir bulan.
      -- due_day = 0 => sentinel "akhir bulan".
      v_next := (v_period + interval '1 month')::date;
      v_lastday := (v_next + interval '1 month - 1 day')::date;
      if v_due_day = 0 then
        v_due := v_lastday;
      else
        v_due := least((v_next + (v_due_day - 1))::date, v_lastday);
      end if;

      -- Nomor urut: MAX + 1 lalu naik sampai bebas (hindari kembar setelah
      -- ada invoice terhapus; dijaga index unik invoice_no).
      select coalesce(max(nullif(regexp_replace(invoice_no, '^.*/', ''), '')::int), 0) + 1
        into v_seq
      from monthly_invoices
      where user_id = v_uid
        and date_trunc('month', period_month) = v_period
        and invoice_no ~ '^INV/\d{4}/\d{2}/\d+$';

      loop
        v_no := 'INV/' || to_char(v_period, 'YYYY/MM') || '/' || lpad(v_seq::text, 3, '0');
        exit when not exists (
          select 1 from monthly_invoices where user_id = v_uid and invoice_no = v_no
        );
        v_seq := v_seq + 1;
      end loop;

      insert into monthly_invoices(user_id, client_id, invoice_no, period_month,
                                   status, total, due_date)
      values (v_uid, v_client, v_no, v_period, 'draft', 0, v_due)
      returning id into v_invoice;
    end if;

    update sales set monthly_invoice_id = v_invoice
      where id = v_sale_id and user_id = v_uid;

    update monthly_invoices set total = coalesce((
      select sum(total) from sales where monthly_invoice_id = v_invoice and user_id = v_uid
    ), 0)
    where id = v_invoice and user_id = v_uid;

    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;

-- ---------- (2) generate_monthly_invoice: gabung ke draft yang sudah ada ----------
create or replace function public.generate_monthly_invoice(p_client_id uuid, p_period_month date, p_due_date date)
  returns uuid
  language plpgsql
  security definer
  as $_$
declare
  v_uid uuid := auth.uid();
  v_start date := date_trunc('month', p_period_month)::date;
  v_end date := (date_trunc('month', p_period_month) + interval '1 month - 1 day')::date;
  v_total numeric(15,2) := 0;
  v_count int;
  v_invoice_id uuid;
  v_seq int;
  v_no text;
begin
  -- ambil penjualan piutang yang belum ditagih pada periode ini
  select coalesce(sum(total),0), count(*) into v_total, v_count
  from sales
  where user_id = v_uid
    and client_id = p_client_id
    and payment_method = 'monthly_invoice'
    and monthly_invoice_id is null
    and sale_date between v_start and v_end;

  if v_count = 0 then
    raise exception 'Tidak ada penjualan piutang untuk client ini pada periode tersebut';
  end if;

  -- Kalau sudah ada invoice DRAFT untuk client+periode ini, GABUNG ke sana
  -- (mis. tagihan maintenance terbit lebih dulu) — jangan bikin invoice kedua.
  -- Invoice yang sudah sent/paid sengaja TIDAK dicari → biar dibuatkan terpisah.
  select id into v_invoice_id
  from monthly_invoices
  where user_id = v_uid
    and client_id = p_client_id
    and period_month = v_start
    and status = 'draft'
  order by created_at
  limit 1;

  if v_invoice_id is null then
    -- Tidak ada draft → buat invoice baru. Nomor MAX + 1 (BR-13), bukan count+1.
    select coalesce(max(nullif(regexp_replace(invoice_no, '^.*/', ''), '')::int), 0) + 1
      into v_seq
    from monthly_invoices
    where user_id = v_uid
      and date_trunc('month', period_month) = v_start
      and invoice_no ~ '^INV/\d{4}/\d{2}/\d+$';

    loop
      v_no := 'INV/' || to_char(v_start, 'YYYY/MM') || '/' || lpad(v_seq::text, 3, '0');
      exit when not exists (
        select 1 from monthly_invoices where user_id = v_uid and invoice_no = v_no
      );
      v_seq := v_seq + 1;
    end loop;

    insert into monthly_invoices(user_id, client_id, invoice_no, period_month, status, total, due_date)
    values (v_uid, p_client_id, v_no, v_start, 'draft', 0, p_due_date)
    returning id into v_invoice_id;
  end if;

  -- tautkan penjualan ke invoice (BR-07)
  update sales set monthly_invoice_id = v_invoice_id
  where user_id = v_uid
    and client_id = p_client_id
    and payment_method = 'monthly_invoice'
    and monthly_invoice_id is null
    and sale_date between v_start and v_end;

  -- hitung ulang total dari SEMUA penjualan yang tertaut (termasuk maintenance
  -- yang mungkin sudah lebih dulu masuk draft ini)
  update monthly_invoices set total = coalesce((
    select sum(total) from sales where monthly_invoice_id = v_invoice_id and user_id = v_uid
  ), 0)
  where id = v_invoice_id and user_id = v_uid;

  return v_invoice_id;
end $_$;
