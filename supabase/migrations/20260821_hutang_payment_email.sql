-- ============================================================================
-- Fase 2 hutang — penanda "bukti pelunasan sudah dikirim email" ke distributor.
-- Sebuah "pembayaran" = sekumpulan nota hutang dengan distributor + paid_date +
-- paid_wallet_id yang sama (pendekatan grouping, tanpa tabel pembayaran khusus).
-- ============================================================================

alter table public.purchases
  add column if not exists pay_email_sent_at timestamptz,
  add column if not exists pay_email_sent_to text;

-- Stempel semua nota dalam satu pembayaran begitu emailnya terkirim.
create or replace function public.mark_hutang_payment_emailed(p_ids uuid[], p_to text)
returns void
language plpgsql
security definer
as $function$
declare v_uid uuid := auth.uid();
begin
  update purchases
     set pay_email_sent_at = now(), pay_email_sent_to = p_to
   where id = any(p_ids) and user_id = v_uid
     and is_credit = true and paid_date is not null;
end $function$;

revoke execute on function public.mark_hutang_payment_emailed(uuid[], text) from anon;
grant  execute on function public.mark_hutang_payment_emailed(uuid[], text) to authenticated;
