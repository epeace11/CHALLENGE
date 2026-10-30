-- Ending a running challenge takes both (October 29, 2026). Rerunnable; run once on PROD CHALLENGE,
-- after cancel-challenge.sql, before deploying the app that uses it. Fresh installs get the same from
-- schema.sql.
--
-- Before Day 1, either person can still cancel (the challenge is deleted). While it runs, one person
-- asks to end it (nx_end_request 'ask') and the other accepts (nx_cancel_challenge) or declines
-- (nx_end_request 'decline'); the one who asked can withdraw. Asking after the partner already asked
-- means both agree, so it ends. Ending keeps the days whose deadline has passed and opens the verdict,
-- as before.
begin;

alter table public.challenges add column if not exists end_asked_by uuid references public.profiles;
alter table public.challenges add column if not exists end_asked_at timestamptz;

-- Ends a running challenge now: the days whose deadline has passed count, later days' answers and
-- points go, and the verdict opens. One that no day has closed on yet is deleted. Internal: it runs
-- once both have agreed. Returns 'deleted' or 'ended'.
create or replace function public.nx_end_now(p_challenge uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c challenges; last_closed date;
begin
  perform nx_tick(p_challenge);
  select * into c from challenges where id = p_challenge;
  -- The latest day whose deadline has passed (as in nx_tick).
  last_closed := least(nx_last_day(c), nx_today(c) - c.deadline_days - case when nx_now() > nx_lock_time(c, nx_today(c) - c.deadline_days) then 0 else 1 end);
  if last_closed < c.start_date then
    delete from challenges where id = c.id;
    return 'deleted';
  end if;
  delete from points where challenge_id = c.id and day > last_closed;
  delete from entries where challenge_id = c.id and day > last_closed;
  update challenges set days = last_closed - start_date + 1, status = 'finished', end_asked_by = null, end_asked_at = null
  where id = c.id;
  -- The last, shorter week's shortfalls, at its share of the target.
  perform nx_tick(c.id);
  return 'ended';
end $$;

-- Before Day 1, the challenge and everything in it is deleted, by either person. While it runs, it
-- ends only once both agree: this is the partner accepting the other's request (nx_end_request).
-- Returns 'deleted' or 'ended'.
create or replace function public.nx_cancel_challenge(p_challenge uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge);
begin
  if c.status = 'finished' then raise exception 'This challenge is already over.'; end if;
  if c.status in ('draft','invited','signing') then
    delete from challenges where id = c.id;
    return 'deleted';
  end if;
  if c.end_asked_by is null or c.end_asked_by = auth.uid() then
    raise exception 'A running challenge ends once you both agree. Ask your partner first.';
  end if;
  return nx_end_now(c.id);
end $$;

-- Asking to end a running challenge early: 'ask', 'withdraw' (the one who asked) or 'decline' (the
-- other). Asking after the partner already asked means both agree, so it ends. Accepting is
-- nx_cancel_challenge. Returns 'asked', 'withdrawn', 'declined', 'ended' or 'deleted'.
create or replace function public.nx_end_request(p_challenge uuid, p_action text) returns text
language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge);
begin
  select * into c from challenges where id = c.id for update;
  if c.status <> 'running' then raise exception 'Only a running challenge can be ended early.'; end if;
  if p_action = 'ask' then
    if c.end_asked_by is not null and c.end_asked_by <> auth.uid() then return nx_end_now(c.id); end if;
    update challenges set end_asked_by = auth.uid(), end_asked_at = nx_now() where id = c.id;
    return 'asked';
  elsif p_action = 'withdraw' then
    if c.end_asked_by is distinct from auth.uid() then raise exception 'You haven''t asked to end it.'; end if;
    update challenges set end_asked_by = null, end_asked_at = null where id = c.id;
    return 'withdrawn';
  elsif p_action = 'decline' then
    if c.end_asked_by is null or c.end_asked_by = auth.uid() then raise exception 'Nobody else asked to end it.'; end if;
    update challenges set end_asked_by = null, end_asked_at = null where id = c.id;
    return 'declined';
  end if;
  raise exception 'Unknown request.';
end $$;

revoke all on function public.nx_end_now(uuid) from public, anon, authenticated;
revoke all on function public.nx_cancel_challenge(uuid) from public, anon;
grant execute on function public.nx_cancel_challenge(uuid) to authenticated;
revoke all on function public.nx_end_request(uuid, text) from public, anon;
grant execute on function public.nx_end_request(uuid, text) to authenticated;

commit;
