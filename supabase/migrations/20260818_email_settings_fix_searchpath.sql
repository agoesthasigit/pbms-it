-- 2026-08-18 — Fix: "function pgp_sym_encrypt(text, text) does not exist" saat
-- simpan pengaturan Email. Di Supabase, pgcrypto terpasang di schema `extensions`
-- (bukan `public`). Fungsi save_email_settings/reveal_email_password sebelumnya
-- memakai `set search_path = public` → menutup akses ke `extensions.pgp_sym_*`.
-- Perbaikan: `set search_path = public, extensions` (fungsi kredensial lama
-- memang tak set search_path sama sekali, jadi mewarisi extensions).

create or replace function public.save_email_settings(
  p_user text, p_from_name text, p_password text, p_key text
) returns void
  language plpgsql security definer
  set search_path = public, extensions
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

create or replace function public.reveal_email_password(p_key text)
returns text
  language plpgsql security definer
  set search_path = public, extensions
as $$
declare v_enc bytea;
begin
  select app_password_enc into v_enc from public.email_settings where user_id = auth.uid();
  if v_enc is null then return ''; end if;
  return pgp_sym_decrypt(v_enc, p_key);
exception when others then return '';
end $$;
