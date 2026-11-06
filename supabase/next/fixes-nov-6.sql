-- Fixes from the November 6, 2026 security review. Rerunnable; run once on PROD CHALLENGE, after
-- saved-copies.sql. The app works with or without it, so it can go before or after the deploy. Fresh
-- installs get the same from schema.sql.
--
-- 1. Nobody can remove a screenshot during a challenge, only once both people have deleted it
--    (nx_deleted_by_all and the proofs_delete policy, at the end).
-- 2. nx_update_challenge clears the signatures when the time zone or week start changes too.
-- 3. nx_create_challenge gives a new challenge its own couple when the one it would join is a couple
--    of one with a challenge: whoever accepted that invite would have seen both.
-- 4. nx_end_now keeps a challenge with screenshots for the app to erase instead of deleting it where
--    they could never be found.
begin;

create or replace function public.nx_deleted_by_all(p_challenge uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists(
    select 1 from challenges c join couple_members m on m.couple_id = c.couple_id
    where c.id = p_challenge and not exists(
      select 1 from hidden_challenges h where h.challenge_id = c.id and h.person_id = m.person_id and h.status = 'deleted'))
$$;

revoke all on function public.nx_deleted_by_all(uuid) from public, anon;
grant execute on function public.nx_deleted_by_all(uuid) to authenticated;

create or replace function public.nx_create_challenge(p_name text, p_look text, p_theme text, p_start date, p_days integer,
  p_time_zone text, p_step numeric, p_cap numeric, p_rules jsonb, p_couple uuid default null, p_new_partner boolean default false)
  returns uuid language plpgsql security definer set search_path = public as $$
declare couple uuid; c challenges;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if not exists(select 1 from profiles where id = auth.uid()) then raise exception 'Add your first name first.'; end if;
  if not exists(select 1 from pg_timezone_names where name = p_time_zone) then raise exception 'Unknown time zone.'; end if;
  if p_couple is not null then
    if not nx_in_couple(p_couple) then raise exception 'That couple isn''t yours.'; end if;
    couple := p_couple;
  elsif not coalesce(p_new_partner, false) then
    select couple_id into couple from couple_members where person_id = auth.uid() order by joined_at desc limit 1;
  end if;
  -- A couple of one with a challenge is waiting on that invite. Whoever accepts joins the couple and
  -- sees all of it, so another challenge gets a couple of its own.
  if (select count(*) from couple_members where couple_id = couple) = 1
     and exists(select 1 from challenges where couple_id = couple) then
    couple := null;
  end if;
  if couple is null then
    insert into couples default values returning id into couple;
    insert into couple_members(couple_id, person_id) values (couple, auth.uid());
  end if;
  insert into challenges(couple_id, name, look, theme, start_date, days, time_zone, step, cap, created_by)
  values (couple, trim(p_name), coalesce(p_look, 'classic'), p_theme, p_start, p_days, p_time_zone, coalesce(p_step, 1), p_cap, auth.uid())
  returning * into c;
  perform nx_put_rules(c, coalesce(p_rules, '[]'));
  return c.id;
end $$;

create or replace function public.nx_update_challenge(p_challenge uuid, p_name text default null, p_look text default null,
  p_start date default null, p_days integer default null, p_time_zone text default null, p_step numeric default null,
  p_cap numeric default null, p_clear_cap boolean default false, p_deadline_days integer default null,
  p_deadline_time time default null, p_week_start integer default null, p_rules jsonb default null)
  returns void language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge);
begin
  -- Name and look can change at any time; everything else only before Day 1.
  if c.status in ('running','finished') and (p_start is not null or p_days is not null or p_time_zone is not null
     or p_step is not null or p_cap is not null or p_clear_cap or p_deadline_days is not null or p_deadline_time is not null
     or p_week_start is not null or p_rules is not null) then
    raise exception 'The rules are set once you''ve both signed.';
  end if;
  if p_time_zone is not null and not exists(select 1 from pg_timezone_names where name = p_time_zone) then
    raise exception 'Unknown time zone.';
  end if;
  update challenges set
    name = coalesce(nullif(trim(p_name), ''), name),
    look = coalesce(p_look, look),
    start_date = coalesce(p_start, start_date),
    days = coalesce(p_days, days),
    time_zone = coalesce(p_time_zone, time_zone),
    step = coalesce(p_step, step),
    cap = case when p_clear_cap then null else coalesce(p_cap, cap) end,
    deadline_days = coalesce(p_deadline_days, deadline_days),
    deadline_time = coalesce(p_deadline_time, deadline_time),
    week_start = coalesce(p_week_start, week_start)
  where id = c.id returning * into c;
  if p_rules is not null then perform nx_put_rules(c, p_rules); end if;
  if c.status in ('invited','signing') and (p_start is not null or p_days is not null or p_time_zone is not null or p_step is not null
     or p_cap is not null or p_clear_cap or p_rules is not null or p_deadline_days is not null or p_deadline_time is not null
     or p_week_start is not null) then
    delete from signatures where challenge_id = c.id;
  end if;
end $$;

create or replace function public.nx_end_now(p_challenge uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c challenges; last_closed date;
begin
  perform nx_tick(p_challenge);
  select * into c from challenges where id = p_challenge;
  -- The latest day whose deadline has passed (as in nx_tick).
  last_closed := least(nx_last_day(c), nx_today(c) - c.deadline_days - case when nx_now() > nx_lock_time(c, nx_today(c) - c.deadline_days) then 0 else 1 end);
  if last_closed < c.start_date then
    if exists(select 1 from storage.objects where bucket_id = 'proofs' and name like c.id::text || '/%') then
      insert into hidden_challenges(challenge_id, person_id, status)
      select c.id, m.person_id, 'deleted' from couple_members m where m.couple_id = c.couple_id
      on conflict (challenge_id, person_id) do update set status = 'deleted', changed_at = nx_now();
      update challenges set status = 'finished', end_asked_by = null, end_asked_at = null where id = c.id;
      return 'erase';
    end if;
    delete from challenges where id = c.id;
    return 'deleted';
  end if;
  if exists(select 1 from disputes where challenge_id = c.id and status = 'open') then
    raise exception 'Settle the open disputes first.';
  end if;
  delete from points where challenge_id = c.id and day > last_closed;
  delete from entries where challenge_id = c.id and day > last_closed;
  -- Both agreed to end it, so answers still waiting for review stand.
  update entries set status = 'confirmed' where challenge_id = c.id and status = 'pending';
  update challenges set days = last_closed - start_date + 1, status = 'finished', end_asked_by = null, end_asked_at = null
  where id = c.id;
  -- The last, shorter week's shortfalls, at its share of the target.
  perform nx_tick(c.id);
  return 'ended';
end $$;

notify pgrst, 'reload schema';

commit;

-- On its own, so the functions above are saved even if this step needs attention.
begin;
drop policy if exists proofs_delete on storage.objects;
create policy proofs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'proofs' and nx_in_challenge(((storage.foldername(name))[1])::uuid)
         and nx_deleted_by_all(((storage.foldername(name))[1])::uuid));
commit;
