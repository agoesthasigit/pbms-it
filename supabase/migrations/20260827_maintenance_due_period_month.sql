-- 2026-08-27
-- Selaraskan jatuh tempo tagihan maintenance dengan jalur penjualan barang.
--
-- MASALAH: issue_maintenance_charges menghitung jatuh tempo di BULAN BERIKUTNYA
-- (v_period + 1 bulan), sedangkan jalur penjualan (find_or_create_invoice / form
-- Penjualan) memakai AKHIR BULAN PERIODE. Akibatnya invoice maintenance-only
-- (client tanpa pembelian barang bulan itu, mis. Rob Peetoom Canggu Agustus 2026)
-- jatuh tempo geser sebulan (30 Sep) sedangkan client yang punya barang tetap
-- akhir bulan periode (31 Agu), karena invoice mereka dibuat lebih dulu oleh
-- jalur penjualan dan maintenance hanya DIGABUNG (tak menyentuh due_date).
--
-- PERBAIKAN: jatuh tempo maintenance kini dihitung di BULAN PERIODE, konsisten.
--   due_day = 0  -> akhir bulan periode.
--   due_day = N  -> tanggal N di bulan periode, di-clamp ke akhir bulan periode.
-- Cabang "gabung ke draft yang sudah ada" tetap TIDAK menyentuh due_date (perilaku
-- lama dipertahankan). Tanda tangan fungsi tidak berubah.

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
  v_lastday date;   -- tgl terakhir bulan PERIODE
  v_count int := 0;
begin
  if jsonb_array_length(p_charges) = 0 then
    raise exception 'Tidak ada kontrak yang dipilih';
  end if;

  v_sale_date := (v_period + interval '1 month - 1 day')::date;
  v_lastday := v_sale_date;  -- akhir bulan periode

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
      -- jatuh tempo = tanggal due_day di bulan PERIODE, di-clamp ke akhir bulan.
      -- due_day = 0 => sentinel "akhir bulan periode".
      if v_due_day = 0 then
        v_due := v_lastday;
      else
        v_due := least((v_period + (v_due_day - 1))::date, v_lastday);
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
