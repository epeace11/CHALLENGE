-- Fixes from a review of the live app (October 18, 2026). Rerunnable; run once on PROD CHALLENGE,
-- after share-links.sql. Fresh installs get the same from schema.sql.
--
-- 1. With a same-night deadline, today can be logged (nx_save_checkin): before, nothing could be
--    logged on time and every check-in became a miss at midnight.
-- 2. One unfinished challenge per couple (nx_create_challenge): starting a new one hid the running one,
--    which kept adding misses. New challenges go to the couple the person joined most recently.
-- 3. An invitee's own solo couple folds into the new one (nx_accept_invite): its saved challenges come
--    along and what it was setting up goes, instead of the person ending up in two couples.
-- 4. Signing after the planned first day moves Day 1 to today (nx_sign_pact), so no day counts as
--    missed before both had agreed.
-- 5. Editing a No keeps its forgiveness and its place in line (nx_add_point, nx_save_checkin,
--    nx_review); only a Yes clears it.
-- 6. Saved challenges record who saved them (saved_by), so each person's own rules stay theirs.
begin;

alter table public.saved_challenges add column if not exists saved_by uuid references public.profiles on delete set null;

-- Its return type changed (the point, not its id), which create or replace can't do.
drop function if exists public.nx_add_point(public.entries, text);
-- The point for an entry's miss (slot 0). A point still counting keeps its place and its forgiveness
-- (the answer was only edited); a new or voided one comes back unforgiven, priced as the newest.
-- Returns the point; the entry shows as forgiven when its point is.
create or replace function public.nx_add_point(e public.entries, p_reason text) returns public.points language plpgsql security definer set search_path = public as $$
declare pt points;
begin
  insert into points(challenge_id, person_id, rule_id, day, reason, entry_id, created_at)
  values (e.challenge_id, e.person_id, e.rule_id, e.day, p_reason, e.id, nx_now())
  on conflict (person_id, rule_id, day, slot) do update
    set reason = excluded.reason, entry_id = excluded.entry_id,
        forgiven = points.forgiven and not points.voided,
        created_at = case when points.voided then excluded.created_at else points.created_at end,
        voided = false
  returning * into pt;
  if pt.forgiven then update entries set status = 'excused' where id = e.id; end if;
  return pt;
end $$;
revoke all on function public.nx_add_point(public.entries, text) from public, anon, authenticated;

-- Starts a challenge in draft: makes the viewer's couple on their first one. Returns its id.
create or replace function public.nx_create_challenge(p_name text, p_look text, p_theme text, p_start date, p_days integer,
  p_time_zone text, p_step numeric, p_cap numeric, p_rules jsonb) returns uuid language plpgsql security definer set search_path = public as $$
declare couple uuid; c challenges; busy text;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if not exists(select 1 from profiles where id = auth.uid()) then raise exception 'Add your first name first.'; end if;
  if not exists(select 1 from pg_timezone_names where name = p_time_zone) then raise exception 'Unknown time zone.'; end if;
  -- The couple the person joined most recently: their current partner.
  select couple_id into couple from couple_members where person_id = auth.uid() order by joined_at desc limit 1;
  -- One challenge at a time: a new one starts once the one being set up or played has finished.
  select name into busy from challenges where couple_id = couple and status <> 'finished' limit 1;
  if busy is not null then raise exception 'Finish % before starting another.', busy; end if;
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
declare i invites := nx_find_invite(p_token); c challenges; solo record;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if not exists(select 1 from profiles where id = auth.uid()) then raise exception 'Add your first name first.'; end if;
  if i.id is null then raise exception 'This invite has expired or was already used. Ask for a new link.'; end if;
  if i.from_id = auth.uid() then raise exception 'This is your own invite. Send it to your partner.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(i.challenge_id::text, 0));
  select * into c from challenges where id = i.challenge_id;
  if (select count(*) from couple_members where couple_id = c.couple_id) >= 2 then raise exception 'This challenge already has two people.'; end if;
  -- A couple the invitee made on their own before (only them in it): its saved challenges come along,
  -- and whatever it was setting up goes. A couple with someone else stays as it is.
  for solo in
    select m.couple_id from couple_members m
    where m.person_id = auth.uid() and m.couple_id <> c.couple_id
      and (select count(*) from couple_members x where x.couple_id = m.couple_id) = 1
  loop
    update saved_challenges set couple_id = c.couple_id where couple_id = solo.couple_id;
    delete from couples where id = solo.couple_id;
  end loop;
  insert into couple_members(couple_id, person_id) values (c.couple_id, auth.uid()) on conflict do nothing;
  update invites set accepted_at = nx_now(), accepted_by = auth.uid() where id = i.id;
  update rules set who = auth.uid(), for_invitee = false where challenge_id = c.id and for_invitee;
  update challenges set status = 'signing' where id = c.id and status in ('draft','invited');
  return c.id;
end $$;

-- Signs the pact. Once both have signed, the challenge is running.
create or replace function public.nx_sign_pact(p_challenge uuid) returns void language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge);
begin
  if c.status not in ('invited','signing') then raise exception 'There''s nothing to sign right now.'; end if;
  insert into signatures(challenge_id, person_id) values (c.id, auth.uid()) on conflict do nothing;
  if c.status = 'signing' and (select count(*) from signatures where challenge_id = c.id) = 2 then
    -- Signed after the planned first day: Day 1 is today, so no day counts before both had agreed.
    update challenges set status = 'running', start_date = greatest(start_date, nx_today(c)) where id = c.id;
  end if;
end $$;

-- Voids an entry's active point and drops a pending forgiveness request on it (the answer changed).
-- The answer became a Yes: its point (forgiven or not) stops counting, and a pending request on it goes.
create or replace function public.nx_void_point_of(p_entry uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  delete from forgiveness_requests where status = 'pending'
    and point_id in (select id from points where entry_id = p_entry and not voided);
  update points set voided = true where entry_id = p_entry and not voided;
end $$;

-- One whole check-in, like saveCheckin() in lib/next/actions.ts. Before the deadline it is the answer;
-- after it, a late answer the partner has to approve.
create or replace function public.nx_save_checkin(p_challenge uuid, p_rule uuid, p_day date, p_done boolean default null,
  p_value numeric default null, p_note text default '', p_proofs jsonb default '[]', p_forgiveness text default null)
  returns void language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge); r rules; e entries; v_done boolean; v_proofs jsonb; v_note text := left(coalesce(p_note, ''), 2000);
  ask text := nullif(trim(coalesce(p_forgiveness, '')), ''); pt points;
begin
  perform nx_tick(c.id);
  select * into c from challenges where id = c.id;
  if c.status not in ('running','finished') then raise exception 'The challenge hasn''t started yet.'; end if;
  select * into r from rules where id = p_rule and challenge_id = c.id;
  if r.id is null or not nx_rule_for(r, auth.uid()) or not nx_applies(c, r, p_day) then raise exception 'That rule isn''t asked on that day.'; end if;
  -- A day is logged once it's over, or during the day itself when its deadline is that night.
  if p_day > nx_today(c) or (p_day = nx_today(c) and c.deadline_days > 0) then
    raise exception 'You can log a day once it''s over.';
  end if;
  v_done := case when r.kind = 'number' then p_value is not null and nx_meets(r, p_value) else coalesce(p_done, false) end;
  if r.kind = 'number' and p_value is null then raise exception 'Enter a number first.'; end if;
  v_proofs := nx_check_proofs(c, p_proofs);
  if v_done and r.proof = 'required' and jsonb_array_length(v_proofs) = 0 then raise exception 'Attach a screenshot first.'; end if;
  if ask is not null and v_done then raise exception 'Forgiveness can only be asked for with a No.'; end if;
  select * into e from entries where person_id = auth.uid() and rule_id = r.id and day = p_day;
  if e.status = 'disputed' then raise exception 'Answer the dispute on this first.'; end if;

  if nx_now() > nx_lock_time(c, p_day) then
    if e.id is null then
      insert into entries(challenge_id, person_id, rule_id, day, done, status)
      values (c.id, auth.uid(), r.id, p_day, null, 'unlogged') returning * into e;
    end if;
    update entries set correction_done = v_done, correction_value = case when r.kind = 'number' then p_value end,
      correction_note = v_note, correction_proofs = v_proofs, correction_at = nx_now() where id = e.id;
    return;
  end if;

  insert into entries(challenge_id, person_id, rule_id, day, done, value, status, note, proofs, logged_at)
  values (c.id, auth.uid(), r.id, p_day, v_done, case when r.kind = 'number' then p_value end,
          case when v_done then 'pending' when r.kind = 'weekly' then 'confirmed' else 'missed' end, v_note, v_proofs, nx_now())
  on conflict (person_id, rule_id, day) do update set done = excluded.done, value = excluded.value, status = excluded.status,
    note = excluded.note, proofs = excluded.proofs, logged_at = excluded.logged_at,
    correction_done = null, correction_value = null, correction_note = null, correction_proofs = null, correction_at = null
  returning * into e;
  if e.status = 'missed' then
    pt := nx_add_point(e, 'missed');
    if ask is not null and not pt.forgiven then
      insert into forgiveness_requests(challenge_id, point_id, from_id, reason) values (c.id, pt.id, auth.uid(), left(ask, 2000))
      on conflict (point_id) where status = 'pending' do update set reason = excluded.reason;
    end if;
  else
    perform nx_void_point_of(e.id);
  end if;
  perform nx_tick(c.id);
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
    if length(trim(coalesce(p_comment, ''))) = 0 then raise exception 'Say what doesn''t look right.'; end if;
    if e.status not in ('pending','confirmed') or e.done is not true then raise exception 'Only a Yes can be disputed.'; end if;
    insert into disputes(challenge_id, entry_id, raised_by, comment) values (e.challenge_id, e.id, auth.uid(), left(trim(p_comment), 2000));
    update entries set status = 'disputed' where id = e.id;
  else
    raise exception 'Unknown review action.';
  end if;
  perform nx_tick(e.challenge_id);
end $$;

-- Saves a challenge's rules and settings under a name. Returns the saved challenge's id.
create or replace function public.nx_save_challenge(p_challenge uuid, p_name text) returns uuid language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge); s uuid;
begin
  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'Give it a name.'; end if;
  insert into saved_challenges(couple_id, name, look, days, step, cap, rules, saved_by)
  values (c.couple_id, left(trim(p_name), 60), c.look, c.days, c.step, c.cap, coalesce((
    select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'title', r.title, 'question', r.question, 'description', r.description, 'group', r.rule_group, 'kind', r.kind,
      'days', to_jsonb(r.days), 'weeklyTarget', r.weekly_target,
      'target', case when r.target_op is not null then jsonb_build_object('op', r.target_op, 'value', r.target_value, 'unit', coalesce(r.target_unit, '')) end,
      'who', case when r.for_invitee then 'partner' when r.who is null then 'both' when r.who = auth.uid() then 'me' else 'partner' end,
      'proof', r.proof)) order by r.position)
    from rules r where r.challenge_id = c.id), '[]'), auth.uid())
  returning id into s;
  return s;
end $$;

create or replace function public.nx_save_shared(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare s saved_challenges; couple uuid; out_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if not exists(select 1 from profiles where id = auth.uid()) then raise exception 'Add your first name first.'; end if;
  select * into s from saved_challenges where link_token = p_token and link_on;
  if s.id is null then raise exception 'This link was turned off.'; end if;
  if nx_in_couple(s.couple_id) then return s.id; end if;
  select couple_id into couple from couple_members where person_id = auth.uid() order by joined_at desc limit 1;
  if couple is null then
    insert into couples default values returning id into couple;
    insert into couple_members(couple_id, person_id) values (couple, auth.uid());
  end if;
  insert into saved_challenges(couple_id, name, look, days, step, cap, rules, saved_by)
  values (couple, s.name, s.look, s.days, s.step, s.cap, s.rules, auth.uid())
  returning id into out_id;
  return out_id;
end $$;

commit;
