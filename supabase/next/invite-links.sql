-- Invite links (October 18, 2026). Rerunnable; run once on PROD CHALLENGE, which was set up before
-- this. Fresh installs get the same from schema.sql.
--
-- 1. Making a new invite link no longer cancels links already sent (opening the app on another
--    device made a new one, and the link the partner had stopped working). Expired ones are cleared.
-- 2. Only the full link opens an invite. The six-character code could be guessed, which would let a
--    stranger join someone's challenge, and the app has nowhere to type it.
begin;

create or replace function public.nx_create_invite(p_challenge uuid, p_to_name text default '', p_to_email text default '')
  returns table(token text, code text) language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge); t text := replace(gen_random_uuid()::text, '-', ''); k text;
begin
  if nx_partner(c.id, auth.uid()) is not null then raise exception 'Your partner is already in.'; end if;
  if c.status not in ('draft','invited') then raise exception 'This challenge has started.'; end if;
  loop
    k := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists(select 1 from invites i where i.code = k);
  end loop;
  -- Links already sent keep working until they expire; only expired ones are cleared.
  delete from invites i where i.challenge_id = c.id and i.accepted_at is null and i.expires_at <= nx_now();
  insert into invites(challenge_id, from_id, to_name, to_email, token_hash, code, expires_at)
  values (c.id, auth.uid(), left(trim(coalesce(p_to_name, '')), 40), left(trim(coalesce(p_to_email, '')), 200),
          encode(sha256(convert_to(t, 'UTF8')), 'hex'), k, nx_now() + interval '7 days');
  return query select t, k;
end $$;

-- Only the full link opens an invite: the short code is too easy to guess to let anyone join with it.
create or replace function public.nx_find_invite(p_token text) returns public.invites language sql stable security definer set search_path = public as $$
  select * from invites
  where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
    and accepted_at is null and expires_at > nx_now()
  limit 1
$$;

revoke all on function public.nx_find_invite(text) from public, anon, authenticated;

commit;
