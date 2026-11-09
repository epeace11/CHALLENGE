-- The timer for timed rules (November 8, 2026). Rerunnable; run once on PROD CHALLENGE, after
-- fixes-nov-6.sql, before deploying the app that uses it (until then its Timer page can't save).
-- Fresh installs get the same from schema.sql.
--
-- 1. A number rule counted in minutes can have the timer on (rules.timed). Either person turns it on
--    or off at any time, even after signing, and the signatures stay (nx_set_timed); Set up saves it
--    (nx_put_rules) and saved copies keep it (nx_save_challenge). Off stops and saves a timer going.
-- 2. Each person times a rule: start, pause, resume, stop (nx_timer), one timer at a time per
--    challenge, every time stamped by the database. timer_runs holds a timer going; timer_sessions
--    each stretch from Start to Stop, counted toward the day it started on. Both people read both;
--    nobody else can. A person removes only their own session (nx_remove_session).
-- 3. A timed day's sessions are saved as its answer by themselves once the day can be logged
--    (nx_timer_log, at each Stop and in nx_tick before any unlogged miss), with entries.from_timer.
--    An answer saved by hand clears it (nx_save_checkin, and nx_review for a late answer) and the
--    timer never changes it. The comment above nx_timer_log has the whole rule.
-- 4. A challenge isn't over while a timer is still going (nx_tick); ending one early stops and saves
--    its timers (nx_end_now). Deleting a challenge removes its timer rows (on delete cascade).
begin;

alter table public.rules add column if not exists timed boolean not null default false;
alter table public.entries add column if not exists from_timer boolean not null default false;

create table if not exists public.timer_runs(
  challenge_id uuid not null references public.challenges on delete cascade,
  person_id uuid not null references public.profiles,
  rule_id uuid not null references public.rules on delete cascade,
  day date not null,
  started_at timestamptz not null,
  running_since timestamptz,
  banked integer not null default 0 check (banked >= 0),
  primary key (challenge_id, person_id)
);
create table if not exists public.timer_sessions(
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges on delete cascade,
  person_id uuid not null references public.profiles,
  rule_id uuid not null references public.rules on delete cascade,
  day date not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  seconds integer not null check (seconds > 0)
);
create index if not exists timer_sessions_challenge on public.timer_sessions(challenge_id, person_id, rule_id, day);

-- Both people read each other's timers and sessions; nobody writes them directly.
alter table public.timer_runs enable row level security;
alter table public.timer_sessions enable row level security;
drop policy if exists read_own on public.timer_runs;
drop policy if exists read_own on public.timer_sessions;
create policy read_own on public.timer_runs for select to authenticated using (nx_in_challenge(challenge_id));
create policy read_own on public.timer_sessions for select to authenticated using (nx_in_challenge(challenge_id));
grant select on public.timer_runs, public.timer_sessions to authenticated;
revoke insert, update, delete on public.timer_runs, public.timer_sessions from anon, authenticated;

-- A rule the timer can time: a number rule counted in minutes ("min", "mins", "minute", "minutes"),
-- like canTime() in lib/next/selectors.ts.
create or replace function public.nx_can_time(p_kind text, p_unit text) returns boolean language sql immutable as $$
  select coalesce(p_kind = 'number' and btrim(p_unit) ~* '^min(ute)?s?$', false)
$$;

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
  -- dispute settled, every answer reviewed (48 hours at most, above), every timer stopped (a timer
  -- only starts on a day of the challenge, and its time still counts). Until then there's no verdict.
  if c.status = 'running' and nx_now() > nx_lock_time(c, nx_last_day(c))
     and not exists(select 1 from disputes where challenge_id = c.id and status = 'open')
     and not exists(select 1 from entries where challenge_id = c.id and status = 'pending' and correction_at is null)
     and not exists(select 1 from timer_runs where challenge_id = c.id) then
    update challenges set status = 'finished' where id = c.id;
  end if;
end $$;

-- Replaces a challenge's rules from a JSON array of Rule objects (lib/next/model.ts). `who` is
-- 'both', 'me' (the caller), 'partner', or a member's id. `timed` sticks only to a rule the timer can time.
create or replace function public.nx_put_rules(c public.challenges, p_rules jsonb) returns void language plpgsql security definer set search_path = public as $$
declare x jsonb; i integer := 0; who uuid; partner uuid := nx_partner(c.id, auth.uid());
begin
  if jsonb_typeof(p_rules) <> 'array' then raise exception 'Rules must be a list.'; end if;
  if jsonb_array_length(p_rules) > 20 then raise exception 'Keep it to 20 rules or fewer.'; end if;
  delete from rules where challenge_id = c.id;
  for x in select * from jsonb_array_elements(p_rules) loop
    who := case
      when coalesce(x->>'who', 'both') = 'both' then null
      when x->>'who' = 'me' then auth.uid()
      when x->>'who' = 'partner' then partner
      when exists(select 1 from couple_members where couple_id = c.couple_id and person_id::text = x->>'who') then (x->>'who')::uuid
      else null end;
    insert into rules(challenge_id, position, title, question, description, rule_group, kind, days, weekly_target,
                      target_op, target_value, target_unit, who, for_invitee, proof, starts_on, ends_on, personal, limits, timed)
    values (c.id, i, trim(x->>'title'), trim(x->>'question'), coalesce(x->>'description', ''),
            coalesce(x->>'group', 'Mind'), x->>'kind',
            array(select jsonb_array_elements_text(x->'days')::integer),
            (x->>'weeklyTarget')::integer,
            x->'target'->>'op', (x->'target'->>'value')::numeric, x->'target'->>'unit',
            who, x->>'who' = 'partner' and partner is null, coalesce(x->>'proof', 'none'), (x->>'startsOn')::date, (x->>'endsOn')::date,
            x->>'kind' = 'number' and coalesce((x->>'personalTarget')::boolean, false),
            -- Limits already set stay with the rule, for the couple's own members only.
            case when x->>'kind' = 'number' and coalesce((x->>'personalTarget')::boolean, false) then coalesce((
              select jsonb_object_agg(l.key, l.value) from jsonb_each(case when jsonb_typeof(x->'limits') = 'object' then x->'limits' else '{}' end) l
              where jsonb_typeof(l.value) = 'number' and (l.value #>> '{}')::numeric > 0
                and exists(select 1 from couple_members m where m.couple_id = c.couple_id and m.person_id::text = l.key)), '{}')
            else '{}' end,
            coalesce((x->>'timed')::boolean, false) and nx_can_time(x->>'kind', x->'target'->>'unit'));
    i := i + 1;
  end loop;
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
  on conflict (person_id, rule_id, day) do update set done = excluded.done, value = excluded.value, status = excluded.status,
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

-- Saves a challenge's rules and settings under a name. Returns the saved challenge's id.
create or replace function public.nx_save_challenge(p_challenge uuid, p_name text) returns uuid language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge); s uuid;
begin
  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'Give it a name.'; end if;
  insert into saved_challenges(couple_id, challenge_id, name, look, days, step, cap, rules, saved_by)
  values (c.couple_id, c.id, left(trim(p_name), 60), c.look, c.days, c.step, c.cap, coalesce((
    select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'title', r.title, 'question', r.question, 'description', r.description, 'group', r.rule_group, 'kind', r.kind,
      'days', to_jsonb(r.days), 'weeklyTarget', r.weekly_target,
      'target', case when r.target_op is not null then jsonb_build_object('op', r.target_op, 'value', r.target_value, 'unit', coalesce(r.target_unit, '')) end,
      'who', case when r.for_invitee then 'partner' when r.who is null then 'both' when r.who = auth.uid() then 'me' else 'partner' end,
      'proof', r.proof, 'personalTarget', case when r.personal then true end,
      'timed', case when r.timed then true end)) order by r.position)
    from rules r where r.challenge_id = c.id), '[]'), auth.uid())
  returning id into s;
  return s;
end $$;

-- Ends a running challenge now: the days whose deadline has passed count, later days' answers and
-- points go, and the verdict opens. One that no day has closed on yet is deleted; with screenshots,
-- it's left deleted by both for the app to erase, because they can't be found once it's gone.
-- Internal: it runs once both have agreed. Returns 'deleted', 'erase' or 'ended'.
create or replace function public.nx_end_now(p_challenge uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c challenges; last_closed date; t record;
begin
  perform nx_tick(p_challenge);
  select * into c from challenges where id = p_challenge;
  -- The latest day whose deadline has passed (as in nx_tick).
  last_closed := least(nx_last_day(c), nx_today(c) - c.deadline_days - case when nx_now() > nx_lock_time(c, nx_today(c) - c.deadline_days) then 0 else 1 end);
  -- Timers still going stop and save, like a Stop; sessions on the days that no longer count go.
  for t in select person_id from timer_runs where challenge_id = c.id loop
    perform nx_stop_timer(c, t.person_id);
  end loop;
  delete from timer_sessions where challenge_id = c.id and day > last_closed;
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

-- A timed day's answer, saved by itself from its sessions (like the Timer page's timedMinutes()):
-- * When: the challenge is running, the day can be logged (it's over, or it's today with a same-night
--   deadline, as in nx_save_checkin) and no timer is still going on that rule and day. Called at each
--   Stop (nx_stop_timer) and by nx_tick, which only fills a day with no answer yet, before it gives
--   unlogged misses. So removing a session (nx_remove_session) never changes an answer already saved.
-- * What: the day's sessions added up, in whole minutes rounded down, scored like a check-in
--   (nx_meets: pending if met, missed with a point if not), from_timer = true. The sessions stand in
--   for screenshots, even when the rule asks for them. Sessions count whether or not the timer is
--   still on: turning it off saves the one going.
-- * Never over: an answer typed by hand (from_timer false), a late answer waiting on the partner, a
--   disputed or conceded one, or one the partner approved once the day's deadline has passed. Before
--   the deadline an approved timer answer changes like a hand edit would, and goes back for review.
--   An unlogged day (nobody answered, no late answer waiting) is filled.
-- * Only days the rule asks, and only the rule's own people.
create or replace function public.nx_timer_log(c public.challenges, p_person uuid, p_rule uuid, p_day date) returns void
language plpgsql security definer set search_path = public as $$
declare r rules; e entries; total integer; v_min integer; v_done boolean;
begin
  if c.status <> 'running' then return; end if;
  select * into r from rules where id = p_rule and challenge_id = c.id;
  if r.id is null or r.kind <> 'number' or not nx_rule_for(r, p_person) or not nx_applies(c, r, p_day) then return; end if;
  if p_day > nx_today(c) or (p_day = nx_today(c) and c.deadline_days > 0) then return; end if;
  if exists(select 1 from timer_runs where challenge_id = c.id and person_id = p_person and rule_id = r.id and day = p_day) then return; end if;
  select coalesce(sum(seconds), 0) into total from timer_sessions
  where challenge_id = c.id and person_id = p_person and rule_id = r.id and day = p_day;
  if total <= 0 then return; end if;
  v_min := total / 60;
  v_done := nx_meets(r, v_min, p_person);
  select * into e from entries where person_id = p_person and rule_id = r.id and day = p_day;
  if e.id is not null then
    if e.correction_at is not null then return; end if;
    if e.from_timer then
      if e.value is not distinct from v_min::numeric or e.status in ('disputed','conceded')
         or (e.status = 'confirmed' and nx_now() > nx_lock_time(c, p_day)) then return; end if;
    elsif e.status <> 'unlogged' then
      return;
    end if;
  end if;
  insert into entries(challenge_id, person_id, rule_id, day, done, value, status, logged_at, from_timer)
  values (c.id, p_person, r.id, p_day, v_done, v_min, case when v_done then 'pending' else 'missed' end, nx_now(), true)
  on conflict (person_id, rule_id, day) do update set done = excluded.done, value = excluded.value,
    status = excluded.status, logged_at = excluded.logged_at, from_timer = true
  returning * into e;
  if e.status = 'missed' then perform nx_add_point(e, 'missed'); else perform nx_void_point_of(e.id); end if;
end $$;

-- Stops `p_person`'s timer, if any: its time (pauses left out) becomes a session on the day it started,
-- and that day's answer is saved from the timer when it can be (nx_timer_log). 0 seconds saves nothing.
create or replace function public.nx_stop_timer(c public.challenges, p_person uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t timer_runs; secs integer;
begin
  delete from timer_runs where challenge_id = c.id and person_id = p_person returning * into t;
  if t.person_id is null then return; end if;
  secs := t.banked + case when t.running_since is null then 0
                          else greatest(0, floor(extract(epoch from nx_now() - t.running_since)))::integer end;
  if secs > 0 then
    insert into timer_sessions(challenge_id, person_id, rule_id, day, started_at, ended_at, seconds)
    values (c.id, p_person, t.rule_id, t.day, t.started_at, nx_now(), secs);
    perform nx_timer_log(c, p_person, t.rule_id, t.day);
  end if;
end $$;

-- The viewer's timer, like startTimer()/pauseTimer()/resumeTimer()/stopTimer() in lib/next/actions.ts:
-- 'start' (p_rule), 'pause', 'resume' or 'stop'. The database stamps every time. One timer per person
-- per challenge: starting stops and saves the one going. It starts only while the challenge runs, before
-- the day's deadline. On a day the rule doesn't ask, the time is kept (it shows in the history) but is
-- never saved as an answer. Pausing, resuming or stopping when there's nothing to pause, resume or stop
-- changes nothing, as in the pure actions.
create or replace function public.nx_timer(p_challenge uuid, p_action text, p_rule uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge); r rules;
begin
  perform nx_tick(c.id);
  select * into c from challenges where id = c.id;
  if c.status <> 'running' then raise exception 'The timer works while the challenge is running.'; end if;
  if p_action = 'start' then
    select * into r from rules where id = p_rule and challenge_id = c.id;
    if r.id is null or not r.timed or not nx_can_time(r.kind, r.target_unit) or not nx_rule_for(r, auth.uid()) then
      raise exception 'That rule isn''t timed for you.';
    end if;
    if nx_now() > nx_lock_time(c, nx_today(c)) then raise exception 'Today''s deadline has passed.'; end if;
    perform nx_stop_timer(c, auth.uid());
    insert into timer_runs(challenge_id, person_id, rule_id, day, started_at, running_since, banked)
    values (c.id, auth.uid(), r.id, nx_today(c), nx_now(), nx_now(), 0);
  elsif p_action = 'pause' then
    update timer_runs set banked = banked + greatest(0, floor(extract(epoch from nx_now() - running_since)))::integer,
      running_since = null
    where challenge_id = c.id and person_id = auth.uid() and running_since is not null;
  elsif p_action = 'resume' then
    update timer_runs set running_since = nx_now()
    where challenge_id = c.id and person_id = auth.uid() and running_since is null;
  elsif p_action = 'stop' then
    perform nx_stop_timer(c, auth.uid());
  else
    raise exception 'Unknown timer action.';
  end if;
  perform nx_tick(c.id);
end $$;

-- Either person turns the timer on or off for a rule counted in minutes, at any time, even after
-- signing: it doesn't change what counts, so the signatures stay. Off stops and saves any timer going
-- on that rule, either person's.
create or replace function public.nx_set_timed(p_challenge uuid, p_rule uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge); r rules; t record;
begin
  select * into r from rules where id = p_rule and challenge_id = c.id;
  if r.id is null then raise exception 'That rule is gone.'; end if;
  if not nx_can_time(r.kind, r.target_unit) then raise exception 'Only a rule counted in minutes can be timed.'; end if;
  if r.timed = coalesce(p_on, false) then return; end if;
  if not coalesce(p_on, false) then
    for t in select person_id from timer_runs where challenge_id = c.id and rule_id = r.id loop
      perform nx_stop_timer(c, t.person_id);
    end loop;
  end if;
  update rules set timed = coalesce(p_on, false) where id = r.id;
  perform nx_tick(c.id);
end $$;

-- Removes one of the viewer's own sessions (timed by mistake). An answer already saved stays as it is.
create or replace function public.nx_remove_session(p_session uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s timer_sessions;
begin
  select * into s from timer_sessions where id = p_session;
  if s.id is null then raise exception 'That session is gone.'; end if;
  perform nx_enter(s.challenge_id);
  if s.person_id <> auth.uid() then raise exception 'You can only remove your own sessions.'; end if;
  delete from timer_sessions where id = s.id;
end $$;

do $$ declare f text; begin
  -- Internal helpers: nobody calls these directly.
  foreach f in array array['nx_can_time(text,text)','nx_timer_log(public.challenges,uuid,uuid,date)',
    'nx_stop_timer(public.challenges,uuid)','nx_tick(uuid)','nx_put_rules(public.challenges,jsonb)','nx_end_now(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  -- What a signed-in person can call.
  foreach f in array array['nx_timer(uuid,text,uuid)','nx_set_timed(uuid,uuid,boolean)','nx_remove_session(uuid)',
    'nx_save_checkin(uuid,uuid,date,boolean,numeric,text,jsonb,text)','nx_review(uuid,text,text)','nx_save_challenge(uuid,text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- Live updates for the timer tables, for when the app subscribes to them.
do $$ declare t text; begin
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['timer_runs','timer_sessions'] loop
      if not exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
