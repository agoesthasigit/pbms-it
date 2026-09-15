-- RAB: kategori pengeluaran (Fase 1) — bagian B.
-- Prasyarat: 20260915_rab_expense_category_enum.sql sudah di-COMMIT (nilai enum
-- 'rab_expense' harus ada sebelum file ini dijalankan).
--
-- Prinsip: kategori MURNI label + pengelompokan tampilan. TIDAK menyentuh alur
-- uang (wallet, laba, HPP, piutang). Kolom opsional (nullable) → data lama aman,
-- baris tanpa kategori digabung ke "Lain-lain" di rekap. Hanya baris expense yang
-- memakai kategori; baris budget selalu null.

-- 1) Kolom kategori pada rab_items (FK ke categories, lepas bila kategori dihapus)
alter table rab_items
  add column if not exists category_id uuid references categories(id) on delete set null;

-- 2) save_rab: teruskan category_id saat menyimpan baris item.
--    (identik dengan versi terpasang; hanya menambah v_category + kolom category_id)
create or replace function public.save_rab(
  p_id uuid, p_client_id uuid, p_project_name text, p_project_date date,
  p_status rab_status, p_notes text, p_items jsonb,
  p_payments jsonb default '[]'::jsonb, p_unlocked boolean default false)
returns uuid
language plpgsql
security definer
as $function$
declare
  v_uid uuid := auth.uid();
  v_rab_id uuid;
  v_current_status rab_status;
  v_item jsonb;
  v_pay jsonb;
  v_item_id uuid;
  v_pay_id uuid;
  v_wallet uuid;
  v_category uuid;
  v_date date;
  v_amount numeric(15,2);
begin
  if p_project_name is null or trim(p_project_name) = '' then
    raise exception 'Nama proyek wajib diisi';
  end if;
  if p_client_id is null then
    raise exception 'Client wajib dipilih';
  end if;

  if p_id is null then
    insert into rab_projects(user_id, client_id, project_name, project_date, status, notes)
    values (v_uid, p_client_id, trim(p_project_name), p_project_date, p_status, nullif(p_notes,''))
    returning id into v_rab_id;
  else
    select status into v_current_status
    from rab_projects where id = p_id and user_id = v_uid;

    if v_current_status is null then
      raise exception 'RAB tidak ditemukan';
    end if;

    if v_current_status = 'done' and not p_unlocked then
      raise exception 'Proyek berstatus Selesai terkunci. Buka kunci dulu untuk mengedit.';
    end if;

    update rab_projects set
      client_id = p_client_id,
      project_name = trim(p_project_name),
      project_date = p_project_date,
      status = p_status,
      notes = nullif(p_notes,'')
    where id = p_id and user_id = v_uid
    returning id into v_rab_id;

    delete from wallet_transactions
      where user_id = v_uid and ref_type = 'rab_expense'
        and ref_id in (select id from rab_items where rab_id = v_rab_id);
    delete from wallet_transactions
      where user_id = v_uid and ref_type = 'rab_payment'
        and ref_id in (select id from rab_payments where rab_id = v_rab_id);

    delete from rab_items where rab_id = v_rab_id and user_id = v_uid;
    delete from rab_payments where rab_id = v_rab_id and user_id = v_uid;
  end if;

  -- ITEM (budget & expense)
  for v_item in select * from jsonb_array_elements(p_items) loop
    if coalesce(trim(v_item->>'item_name'),'') <> '' then
      v_wallet   := nullif(v_item->>'paid_wallet_id','')::uuid;
      v_date     := nullif(v_item->>'paid_date','')::date;
      v_category := nullif(v_item->>'category_id','')::uuid;

      insert into rab_items(user_id, rab_id, item_type, item_name, qty, price, sort_order,
                            paid_date, paid_wallet_id, category_id)
      values (v_uid, v_rab_id,
              (v_item->>'item_type')::rab_item_type,
              trim(v_item->>'item_name'),
              coalesce((v_item->>'qty')::numeric, 1),
              coalesce((v_item->>'price')::numeric, 0),
              coalesce((v_item->>'sort_order')::int, 0),
              v_date, v_wallet,
              case when (v_item->>'item_type') = 'expense' then v_category else null end)
      returning id, total into v_item_id, v_amount;

      if (v_item->>'item_type') = 'expense' and v_wallet is not null and v_amount > 0 then
        insert into wallet_transactions(user_id, wallet_id, type, amount, tx_date,
                                        ref_type, ref_id, description)
        values (v_uid, v_wallet, 'expense', v_amount,
                coalesce(v_date, p_project_date), 'rab_expense', v_item_id,
                'Proyek: ' || trim(p_project_name) || ' — ' || trim(v_item->>'item_name'));
      end if;
    end if;
  end loop;

  -- TERMIN
  for v_pay in select * from jsonb_array_elements(p_payments) loop
    v_amount := coalesce((v_pay->>'amount')::numeric, 0);
    v_wallet := nullif(v_pay->>'wallet_id','')::uuid;
    if v_amount > 0 then
      if v_wallet is null then
        raise exception 'Termin "%" wajib memilih wallet',
          coalesce(v_pay->>'description','(tanpa keterangan)');
      end if;
      insert into rab_payments(user_id, rab_id, payment_date, description, amount,
                               wallet_id, sort_order)
      values (v_uid, v_rab_id,
              coalesce(nullif(v_pay->>'payment_date','')::date, current_date),
              coalesce(nullif(trim(v_pay->>'description'),''), 'Termin'),
              v_amount, v_wallet,
              coalesce((v_pay->>'sort_order')::int, 0))
      returning id, payment_date into v_pay_id, v_date;

      insert into wallet_transactions(user_id, wallet_id, type, amount, tx_date,
                                      ref_type, ref_id, description)
      values (v_uid, v_wallet, 'income', v_amount, v_date, 'rab_payment', v_pay_id,
              'Termin proyek: ' || trim(p_project_name));
    end if;
  end loop;

  return v_rab_id;
end $function$;

-- 3) Seed kategori awal untuk SETIAP pemilik data (idempoten: lewati bila sudah ada).
insert into categories (user_id, name, type)
select u.user_id, x.name, 'rab_expense'::category_type
from (select distinct user_id from categories) u
cross join (values
  ('CCTV'), ('AUDIO'), ('NETWORK'), ('TRANSPORT'), ('KOMPUTER'),
  ('LISTRIK'), ('ABSENSI'), ('MAKAN'), ('LAIN-LAIN'), ('TUKANG'), ('TARIK KABEL')
) as x(name)
where not exists (
  select 1 from categories c
  where c.user_id = u.user_id and c.type = 'rab_expense' and c.name = x.name
);
