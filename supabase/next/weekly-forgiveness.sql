-- Forgiving a weekly rule's No (November 12, 2026). A weekly No costs nothing on its own day (the
-- week's shortfall does, once the week is over), so there was no point to ask about. Now the No can
-- carry a forgiveness request, saved with the answer (nx_save_checkin); if the partner forgives it
-- (nx_decide_forgiveness), that day counts toward the week like a Yes (nx_tick), even once the week
-- is over. A Yes drops a request still waiting (nx_save_checkin, nx_review). Rerunnable; run once on
-- PROD CHALLENGE, after goals.sql, before deploying the app that uses it. Fresh installs get the same
-- from schema.sql.
begin;

-- A request is about a point or, for a weekly No, about the answer.
alter table public.forgiveness_requests alter column point_id drop not null;
alter table public.forgiveness_requests add column if not exists entry_id uuid references public.entries on delete cascade;
alter table public.forgiveness_requests drop constraint if exists forgiveness_requests_one_target;
alter table public.forgiveness_requests add constraint forgiveness_requests_one_target check (num_nonnulls(point_id, entry_id) = 1);
create unique index if not exists forgiveness_one_pending_entry on public.forgiveness_requests(entry_id) where status = 'pending';

-- Idempotent. Runs before every write and on every load (nx_sync), and hourly if pg_cron is set up.
create or replace function public.nx_tick(p_challenge uuid) returns void language plpgsql security definer set search_path = public as $$
declare c challenges; wr rules; mem record; wk record; visits integer; target integer; i integer; last_closed date; g record;
begin
  select * into c from challenges where id = p_challenge;
  if c.id is null or c.status not in ('running','finished') then return; end if;
  -- The latest day whose deadline has passed.
  last_closed := least(nx_last_day(c), nx_today(c) - c.deadline_days - case when nx_now() > nx_lock_time(c, nx_today(c) - c.deadline_days) then 0 else 1 end);

  -- Timed days first, so one with sessions gets its answer instead of an unlogged miss: every day
  -- that can be logged, has sessions and no answer yet (none, or unlogged with no late answer
  -- waiting). nx_timer_log has the whole rule; an answer already there only changes at a Stop.
  if c.status = 'running' then
    for g in
      select distinct s.person_id, s.rule_id, s.day from timer_sessions s
      where s.challenge_id = c.id and (s.day < nx_today(c) or (s.day = nx_today(c) and c.deadline_days = 0))
        and not exists(select 1 from entries e where e.person_id = s.person_id and e.rule_id = s.rule_id and e.day = s.day
                       and (e.status <> 'unlogged' or e.correction_at is not null))
    loop
      perform nx_timer_log(c, g.person_id, g.rule_id, g.day);
    end loop;
  end if;

  -- Unlogged misses: every closed day a daily rule applied and nothing was logged. A day with a timer
  -- still going on that rule waits: its answer is saved when the timer stops.
  if last_closed >= c.start_date then
    insert into entries(challenge_id, person_id, rule_id, day, done, status)
    select c.id, m.person_id, r.id, d::date, null, 'unlogged'
    from rules r
    join couple_members m on m.couple_id = c.couple_id and (r.who is null or r.who = m.person_id)
    cross join generate_series(c.start_date, last_closed, interval '1 day') d
    where r.challenge_id = c.id and r.kind <> 'weekly' and nx_applies(c, r, d::date)
      and not exists(select 1 from timer_runs t
                     where t.challenge_id = c.id and t.person_id = m.person_id and t.rule_id = r.id and t.day = d::date)
    on conflict (person_id, rule_id, day) do nothing;

    insert into points(challenge_id, person_id, rule_id, day, reason, entry_id)
    select e.challenge_id, e.person_id, e.rule_id, e.day, 'unlogged', e.id
    from entries e join rules r on r.id = e.rule_id
    where e.challenge_id = c.id and e.status = 'unlogged' and r.kind <> 'weekly' and e.day <= last_closed
    on conflict (person_id, rule_id, day, slot) do nothing;
  end if;

  -- Weekly shortfalls, once a week's last day has closed: one point per visit short of the target.
  -- A No the partner forgave counts as a visit.
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
          and ((done is true and status in ('confirmed','pending','disputed')) or status = 'excused');
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
  -- dispute settled, every answer reviewed (48 hours at most, above), every timer stopped (a timer
  -- only starts on a day of the challenge, and its time still counts). Until then there's no verdict.
  if c.status = 'running' and nx_now() > nx_lock_time(c, nx_last_day(c))
     and not exists(select 1 from disputes where challenge_id = c.id and status = 'open')
     and not exists(select 1 from entries where challenge_id = c.id and status = 'pending' and correction_at is null)
     and not exists(select 1 from timer_runs where challenge_id = c.id) then
    update challenges set status = 'finished' where id = c.id;
  end if;
end $$;

-- One whole check-in, like saveCheckin() in lib/next/actions.ts. Before the deadline it is the answer;
-- after it, a late answer the partner has to approve. Saved by hand, so never from the timer: the
-- timer doesn't change it afterwards (nx_timer_log). A late answer clears from_timer once approved.
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
  v_done := case when r.kind = 'number' then p_value is not null and nx_meets(r, p_value, auth.uid()) else coalesce(p_done, false) end;
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

  insert into entries(challenge_id, person_id, rule_id, day, done, value, status, note, proofs, logged_at, from_timer)
  values (c.id, auth.uid(), r.id, p_day, v_done, case when r.kind = 'number' then p_value end,
          case when v_done then 'pending' when r.kind = 'weekly' then 'confirmed' else 'missed' end, v_note, v_proofs, nx_now(), false)
  on conflict (person_id, rule_id, day) do update set done = excluded.done, value = excluded.value,
    -- A weekly No that was forgiven stays forgiven when only its note or screenshots change.
    status = case when entries.status = 'excused' and excluded.status = 'confirmed' and excluded.done is false
                  then 'excused' else excluded.status end,
    note = excluded.note, proofs = excluded.proofs, logged_at = excluded.logged_at, from_timer = false,
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
    -- A weekly No can ask to be forgiven; a Yes drops the request.
    if e.done then
      delete from forgiveness_requests where entry_id = e.id and status = 'pending';
    elsif ask is not null and e.status = 'confirmed' then
      insert into forgiveness_requests(challenge_id, entry_id, from_id, reason) values (c.id, e.id, auth.uid(), left(ask, 2000))
      on conflict (entry_id) where status = 'pending' do update set reason = excluded.reason;
    end if;
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
      -- The late answer was typed by hand: the timer no longer changes it.
      update entries set done = correction_done, value = correction_value, note = coalesce(correction_note, ''),
        proofs = coalesce(correction_proofs, '[]'), logged_at = nx_now(), from_timer = false,
        status = case when correction_done then 'confirmed' when r.kind <> 'weekly' then 'missed'
                      when status = 'excused' then 'excused' else 'confirmed' end,
        correction_done = null, correction_value = null, correction_note = null, correction_proofs = null, correction_at = null
      where id = e.id returning * into e;
      if e.status = 'missed' then perform nx_add_point(e, 'missed'); else perform nx_void_point_of(e.id); end if;
      if e.done then delete from forgiveness_requests where entry_id = e.id and status = 'pending'; end if;
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

-- The partner decides a forgiveness request. A weekly No they forgive counts toward its week, which
-- can take back a point for a week already over (nx_tick).
create or replace function public.nx_decide_forgiveness(p_request uuid, p_approve boolean) returns void language plpgsql security definer set search_path = public as $$
declare q forgiveness_requests;
begin
  select * into q from forgiveness_requests where id = p_request;
  if q.id is null then raise exception 'That request is gone.'; end if;
  perform nx_enter(q.challenge_id);
  select * into q from forgiveness_requests where id = p_request for update;
  if q.from_id = auth.uid() then raise exception 'Only your partner can decide this.'; end if;
  if q.status <> 'pending' then raise exception 'This was already decided.'; end if;
  update forgiveness_requests set status = case when p_approve then 'approved' else 'denied' end, decided_at = nx_now() where id = q.id;
  if p_approve and q.point_id is not null then perform nx_forgive(q.point_id); end if;
  if p_approve and q.entry_id is not null then
    update entries set status = 'excused' where id = q.entry_id and done is false and status = 'confirmed';
    perform nx_tick(q.challenge_id);
  end if;
end $$;

revoke all on function public.nx_tick(uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;

-- Shows whether it took: expect entry_column = true and counts_forgiven = true.
select exists(select 1 from information_schema.columns
              where table_name = 'forgiveness_requests' and column_name = 'entry_id') as entry_column,
       position('status = ''excused''' in (select prosrc from pg_proc where proname = 'nx_tick')) > 0 as counts_forgiven;
