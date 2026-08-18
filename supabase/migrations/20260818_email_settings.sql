-- 2026-08-18 — Revisi 3 (Opsi C): kredensial Gmail disimpan di DATABASE (bukan
-- hanya .env.local), dikelola lewat UI menu Pengaturan. Tujuan: app "full online"
-- (Vercel) — kredensial tidak hilang saat folder lokal dihapus, dan bisa diubah
-- kapan saja tanpa edit file/redeploy.
--
-- Password Gmail (App Password) disimpan TERENKRIPSI memakai pola kredensial yang
-- sudah ada di app (pgcrypto pgp_sym_encrypt + kunci CREDENTIALS_SECRET_KEY),
-- sama seperti password Network/CCTV/WiFi.
--
-- Mailer (src/lib/email/mailer.ts) membaca DB dulu; bila kosong → fallback ke
-- env GMAIL_* (mundur-kompatibel, tak ada regresi di deployment yang sudah jalan).

create table if not exists public.email_settings (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  gmail_user       text,
  gmail_from_name  text,
  app_password_enc bytea,
  updated_at       timestamptz not null default now()
);

alter table public.email_settings enable row level security;

drop policy if exists email_settings_owner on public.email_settings;
create policy email_settings_owner on public.email_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Simpan/ubah pengaturan. Password hanya di-set bila p_password TIDAK kosong,
-- sehingga menyimpan perubahan user/nama TANPA mengisi ulang password akan
-- mempertahankan password lama. Spasi pada App Password Gmail dibuang.
create or replace function public.save_email_settings(
  p_user text, p_from_name text, p_password text, p_key text
) returns void
  language plpgsql security definer
  set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Tidak ada sesi login'; end if;

  insert into public.email_settings(user_id, gmail_user, gmail_from_name, app_password_enc, updated_at)
  values (
    v_uid,
    nullif(trim(coalesce(p_user,'')), ''),
    nullif(trim(coalesce(p_from_name,'')), ''),
    case when coalesce(p_password,'') <> ''
         then pgp_sym_encrypt(replace(p_password,' ',''), p_key) else null end,
    now()
  )
  on conflict (user_id) do update set
    gmail_user       = excluded.gmail_user,
    gmail_from_name  = excluded.gmail_from_name,
    app_password_enc = case when coalesce(p_password,'') <> ''
                            then pgp_sym_encrypt(replace(p_password,' ',''), p_key)
                            else public.email_settings.app_password_enc end,
    updated_at       = now();
end $$;

-- Baca pengaturan aman (TANPA membocorkan password) untuk UI.
create or replace function public.get_email_settings()
returns table(gmail_user text, gmail_from_name text, has_password boolean)
  language sql security definer
  set search_path = public
as $$
  select gmail_user, gmail_from_name, (app_password_enc is not null)
  from public.email_settings where user_id = auth.uid();
$$;

-- Dekripsi password untuk dipakai server-side (mailer). Kunci salah/korup → ''.
create or replace function public.reveal_email_password(p_key text)
returns text
  language plpgsql security definer
  set search_path = public
as $$
declare v_enc bytea;
begin
  select app_password_enc into v_enc from public.email_settings where user_id = auth.uid();
  if v_enc is null then return ''; end if;
  return pgp_sym_decrypt(v_enc, p_key);
exception when others then return '';
end $$;

grant execute on function public.save_email_settings(text,text,text,text) to authenticated;
grant execute on function public.get_email_settings() to authenticated;
grant execute on function public.reveal_email_password(text) to authenticated;
