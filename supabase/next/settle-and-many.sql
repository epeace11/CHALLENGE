-- Settling, and several challenges at once (November 4, 2026). Rerunnable; run once on PROD CHALLENGE,
-- after pact-limits.sql, before deploying the app that uses it. Fresh installs get the same from schema.sql.
--
-- 1. A challenge isn't over until it's settled (nx_tick): after the last deadline it waits for every
--    dispute to be settled and every answer reviewed. Nothing can be disputed once it's finished
--    (nx_review), and it can't be ended early with a dispute open (nx_end_now, nx_end_request).
-- 2. A person can have several challenges at once, with the same partner or different ones
--    (nx_create_challenge's p_couple and p_new_partner). The one-at-a-time rule is gone.
-- 3. Accepting an invite keeps a challenge the invitee was setting up with someone else, and two people
--    who are already a couple stay one (nx_accept_invite).
begin;

-- It takes two new arguments, which create or replace can't do.
drop function if exists public.nx_create_challenge(text, text, text, date, integer, text, numeric, numeric, jsonb);

-- Idempotent. Runs before every write and on every load (nx_sync), and hourly if pg_cron is set up.
create or replace function public.nx_tick(p_challenge uuid) returns void language plpgsql security definer set search_path = public as $$
declare c challenges; wr rules; mem record; wk record; visits integer; target integer; i integer; last_closed date;
begin
  select * into c from challenges where id = p_challenge;
  if c.id is null or c.status not in ('running','finished') then return; end if;
  -- The latest day whose deadline has passed.
  last_closed := least(nx_last_day(c), nx_today(c) - c.deadline_days - case when nx_now() > nx_lock_time(c, nx_today(c) - c.deadline_days) then 0 else 1 end);

  -- Unlogged misses: every closed day a daily rule applied and nothing was logged.
  if last_closed >= c.start_date then
    insert into entries(challenge_id, person_id, rule_id, day, done, status)
    select c.id, m.person_id, r.id, d::date, null, 'unlogged'
    from rules r
    join couple_members m on m.couple_id = c.couple_id and (r.who is null or r.who = m.person_id)
    cross join generate_series(c.start_date, last_closed, interval '1 day') d
    where r.challenge_id = c.id and r.kind <> 'weekly' and nx_applies(c, r, d::date)
    on conflict (person_id, rule_id, day) do nothing;

    insert into points(challenge_id, person_id, rule_id, day, reason, entry_id)
    select e.challenge_id, e.person_id, e.rule_id, e.day, 'unlogged', e.id
    from entries e join rules r on r.id = e.rule_id
    where e.challenge_id = c.id and e.status = 'unlogged' and r.kind <> 'weekly' and e.day <= last_closed
    on conflict (person_id, rule_id, day, slot) do nothing;
  end if;

  -- Weekly shortfalls, once a week's last day has closed: one point per visit short of the target.
  for wr in select * from rules where challenge_id = c.id and kind = 'weekly' loop
    for wk in
      with s as (
        select d::date ws from generate_series(c.start_date, nx_last_day(c), interval '1 day') d
        where d::date = c.start_date or extract(dow from d)::integer = c.week_start)
      select ws, least(nx_last_day(c), coalesce(
        (select min(s2.ws) - 1 from s s2 where s2.ws > s.ws), nx_last_day(c))) we
      from s
    loop
      continue when wk.we > last_closed;
      target := nx_week_target(c, wr, wk.ws, wk.we);
      for mem in select person_id from couple_members where couple_id = c.couple_id and (wr.who is null or wr.who = person_id) loop
        select count(*) into visits from entries
        where person_id = mem.person_id and rule_id = wr.id and day between wk.ws and wk.we
          and done is true and status in ('confirmed','pending','disputed');
        for i in 1..coalesce(target, 0) loop
          insert into points(challenge_id, person_id, rule_id, day, reason, slot, voided)
          values (c.id, mem.person_id, wr.id, wk.we, 'weekly', i, i > greatest(0, target - visits))
          on conflict (person_id, rule_id, day, slot) do update set voided = excluded.voided
          where points.voided is distinct from excluded.voided;
        end loop;
      end loop;
    end loop;
  end loop;

  -- Answers nobody reviewed in 48 hours count as approved.
  update entries set status = 'confirmed'
  where challenge_id = c.id and status = 'pending' and correction_at is null and logged_at <= nx_now() - interval '48 hours';

  -- It's over once the last deadline has passed and nothing can still change the result: every
  -- dispute settled, every answer reviewed (48 hours at most, above). Until then there's no verdict.
  if c.status = 'running' and nx_now() > nx_lock_time(c, nx_last_day(c))
     and not exists(select 1 from disputes where challenge_id = c.id and status = 'open')
     and not exists(select 1 from entries where challenge_id = c.id and status = 'pending') then
    update challenges set status = 'finished' where id = c.id;
  end if;
end $$;

-- The partner reviews an answer: 'approve' (an answer or a late answer), 'reject' (a late answer), or 'dispute'.
create or replace function public.nx_review(p_entry uuid, p_action text, p_comment text default '') returns void language plpgsql security definer set search_path = public as $$
declare e entries; c challenges; r rules;
begin
  select * into e from entries where id = p_entry;
  if e.id is null then raise exception 'That answer is gone.'; end if;
  c := nx_enter(e.challenge_id);
  select * into e from entries where id = p_entry for update;
  if e.person_id = auth.uid() then raise exception 'Only your partner can review this.'; end if;
  select * into r from rules where id = e.rule_id;
  if p_action = 'approve' then
    if e.correction_at is null then
      if e.status <> 'pending' then raise exception 'This answer isn''t waiting on you.'; end if;
      update entries set status = 'confirmed' where id = e.id;
    else
      update entries set done = correction_done, value = correction_value, note = coalesce(correction_note, ''),
        proofs = coalesce(correction_proofs, '[]'), logged_at = nx_now(),
        status = case when correction_done or r.kind = 'weekly' then 'confirmed' else 'missed' end,
        correction_done = null, correction_value = null, correction_note = null, correction_proofs = null, correction_at = null
      where id = e.id returning * into e;
      if e.status = 'missed' then perform nx_add_point(e, 'missed'); else perform nx_void_point_of(e.id); end if;
    end if;
  elsif p_action = 'reject' then
    if e.correction_at is null then raise exception 'There''s no late answer to turn down.'; end if;
    update entries set correction_done = null, correction_value = null, correction_note = null, correction_proofs = null, correction_at = null where id = e.id;
  elsif p_action = 'dispute' then
    if c.status = 'finished' then raise exception 'This challenge is over.'; end if;
    if length(trim(coalesce(p_comment, ''))) = 0 then raise exception 'Say what doesn''t look right.'; end if;
    if e.status not in ('pending','confirmed') or e.done is not true then raise exception 'Only a Yes can be disputed.'; end if;
    insert into disputes(challenge_id, entry_id, raised_by, comment) values (e.challenge_id, e.id, auth.uid(), left(trim(p_comment), 2000));
    update entries set status = 'disputed' where id = e.id;
  else
    raise exception 'Unknown review action.';
  end if;
  perform nx_tick(e.challenge_id);
end $$;

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
    if exists(select 1 from disputes where challenge_id = c.id and status = 'open') then
      raise exception 'Settle the open disputes first.';
    end if;
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

-- Starts a challenge in draft. A person can have several at once, with the same partner or different
-- ones. p_couple: with that partner. p_new_partner: with someone new, so a couple of one until they
-- accept the invite. Neither: the couple joined most recently (a first one makes it). Returns its id.
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

-- The partner joins the couple and the pact opens.
create or replace function public.nx_accept_invite(p_token text) returns uuid language plpgsql security definer set search_path = public as $$
declare i invites := nx_find_invite(p_token); c challenges; solo record; shared uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if not exists(select 1 from profiles where id = auth.uid()) then raise exception 'Add your first name first.'; end if;
  if i.id is null then raise exception 'This invite has expired or was already used. Ask for a new link.'; end if;
  if i.from_id = auth.uid() then raise exception 'This is your own invite. Send it to your partner.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(i.challenge_id::text, 0));
  select * into c from challenges where id = i.challenge_id;
  if (select count(*) from couple_members where couple_id = c.couple_id) >= 2 then raise exception 'This challenge already has two people.'; end if;
  -- A couple the invitee made on their own that has no challenge (only them in it): its saved
  -- challenges come along. One with a challenge is waiting for someone else to join, so it stays.
  for solo in
    select m.couple_id from couple_members m
    where m.person_id = auth.uid() and m.couple_id <> c.couple_id
      and (select count(*) from couple_members x where x.couple_id = m.couple_id) = 1
      and not exists(select 1 from challenges x where x.couple_id = m.couple_id)
  loop
    update saved_challenges set couple_id = c.couple_id where couple_id = solo.couple_id;
    delete from couples where id = solo.couple_id;
  end loop;
  -- Two people who are already a couple stay one: the challenge moves there.
  select a.couple_id into shared from couple_members a join couple_members b using (couple_id)
  where a.person_id = i.from_id and b.person_id = auth.uid() limit 1;
  if shared is not null then
    update challenges set couple_id = shared where couple_id = c.couple_id;
    update saved_challenges set couple_id = shared where couple_id = c.couple_id;
    delete from couples where id = c.couple_id;
  else
    insert into couple_members(couple_id, person_id) values (c.couple_id, auth.uid()) on conflict do nothing;
  end if;
  update invites set accepted_at = nx_now(), accepted_by = auth.uid() where id = i.id;
  update rules set who = auth.uid(), for_invitee = false where challenge_id = c.id and for_invitee;
  update challenges set status = 'signing' where id = c.id and status in ('draft','invited');
  return c.id;
end $$;

revoke all on function public.nx_create_challenge(text, text, text, date, integer, text, numeric, numeric, jsonb, uuid, boolean) from public, anon;
grant execute on function public.nx_create_challenge(text, text, text, date, integer, text, numeric, numeric, jsonb, uuid, boolean) to authenticated;

commit;
