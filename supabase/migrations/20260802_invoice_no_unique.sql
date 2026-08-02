-- ============================================================
-- BUG: nomor invoice bisa KEMBAR setelah ada invoice dihapus.
--
-- Penyebab: generate_monthly_invoice menentukan nomor urut dengan
--   select count(*) + 1 ... where bulan sama
-- Begitu satu invoice dihapus, count() ikut turun sehingga nomor yang
-- sudah pernah dipakai diberikan lagi ke invoice berikutnya.
--
-- Kejadian nyata (Juli 2026): 003 & 004 sempat dihapus, Canggu lalu
-- mengambil 004, dan invoice Rob Peetoom School (dibuat 2 Agustus)
-- mendapat 005 yang sudah dipakai Rob Peetoom Ubud.
--
-- Perbaikan:
--   1. Rapikan nomor kembar yang sudah terlanjur ada.
--   2. Nomor urut diambil dari MAX nomor yang pernah dipakai + 1
--      (bukan count), lalu dinaikkan sampai benar-benar belum terpakai.
--      Nomor bekas invoice yang dihapus TIDAK dipakai ulang — memang
--      seharusnya begitu, nomor invoice tidak boleh didaur ulang.
--   3. Indeks UNIK sebagai pengaman terakhir.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Rapikan nomor kembar: yang paling lama menang, sisanya
--    diberi nomor baru setelah nomor tertinggi di bulannya.
-- ------------------------------------------------------------
do $$
declare
  r record;
  v_seq   int;
  v_no    text;
  v_start date;
begin
  for r in
    select id, user_id, invoice_no, period_month, created_at
    from (
      select id, user_id, invoice_no, period_month, created_at,
             row_number() over (
               partition by user_id, invoice_no order by created_at
             ) as rn
      from monthly_invoices
    ) x
    where rn > 1
    order by created_at
  loop
    v_start := date_trunc('month', r.period_month)::date;

    select coalesce(max(nullif(regexp_replace(invoice_no, '^.*/', ''), '')::int), 0) + 1
      into v_seq
    from monthly_invoices
    where user_id = r.user_id
      and date_trunc('month', period_month) = v_start
      and invoice_no ~ '^INV/\d{4}/\d{2}/\d+$';

    loop
      v_no := 'INV/' || to_char(v_start, 'YYYY/MM') || '/' || lpad(v_seq::text, 3, '0');
      exit when not exists (
        select 1 from monthly_invoices
        where user_id = r.user_id and invoice_no = v_no
      );
      v_seq := v_seq + 1;
    end loop;

    update monthly_invoices set invoice_no = v_no where id = r.id;

    -- keterangan mutasi wallet ikut menyesuaikan (akhiran PPh dipertahankan)
    update wallet_transactions
      set description = replace(description, r.invoice_no, v_no)
      where ref_type = 'invoice' and ref_id = r.id;

    raise notice 'Nomor kembar % diubah menjadi % (id %)', r.invoice_no, v_no, r.id;
  end loop;
end $$;

-- ------------------------------------------------------------
-- 2. Penomoran baru: MAX + 1, lalu naik sampai benar-benar bebas.
-- ------------------------------------------------------------
create or replace function public.generate_monthly_invoice(
  p_client_id uuid, p_period_month date, p_due_date date
)
returns uuid
language plpgsql
security definer
as $function$
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

  -- Nomor urut pada bulan yang sama (BR-13).
  -- Memakai MAX + 1, BUKAN count + 1: kalau ada invoice yang dihapus,
  -- count ikut turun dan nomor lama akan terpakai ulang → kembar.
  select coalesce(max(nullif(regexp_replace(invoice_no, '^.*/', ''), '')::int), 0) + 1
    into v_seq
  from monthly_invoices
  where user_id = v_uid
    and date_trunc('month', period_month) = v_start
    and invoice_no ~ '^INV/\d{4}/\d{2}/\d+$';

  -- Jaring pengaman: naikkan sampai nomornya benar-benar belum terpakai.
  loop
    v_no := 'INV/' || to_char(v_start, 'YYYY/MM') || '/' || lpad(v_seq::text, 3, '0');
    exit when not exists (
      select 1 from monthly_invoices where user_id = v_uid and invoice_no = v_no
    );
    v_seq := v_seq + 1;
  end loop;

  insert into monthly_invoices(user_id, client_id, invoice_no, period_month, status, total, due_date)
  values (v_uid, p_client_id, v_no, v_start, 'draft', v_total, p_due_date)
  returning id into v_invoice_id;

  -- tautkan penjualan ke invoice (BR-07)
  update sales set monthly_invoice_id = v_invoice_id
  where user_id = v_uid
    and client_id = p_client_id
    and payment_method = 'monthly_invoice'
    and monthly_invoice_id is null
    and sale_date between v_start and v_end;

  return v_invoice_id;
end $function$;

-- ------------------------------------------------------------
-- 3. Pengaman terakhir: nomor invoice wajib unik per pengguna.
-- ------------------------------------------------------------
create unique index if not exists monthly_invoices_user_invoice_no_uniq
  on monthly_invoices(user_id, invoice_no);
