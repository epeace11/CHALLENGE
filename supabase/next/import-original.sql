-- Brings Erin and Kazzy's Sep 15 – Oct 14, 2026 challenge into the new schema as a finished challenge.
-- Run in the SQL editor after supabase/next/schema.sql, in a project that also holds the old app's
-- challenge_* tables (supabase/setup.sql's schema with the live data loaded). Then:
--
--   select public.nx_import_original('<Erin''s new account id>', '<Kazzy''s new account id>');
--
-- Run it after the two have paired with an invite: the Original joins their couple as a finished
-- challenge. (Before pairing it makes a couple of its own, which the next invite would hide.)
-- It returns the new challenge's id. Screenshots move separately: each old file
-- challenge-proof/<old account id>/<file> goes to proofs/<new challenge id>/<new account id>/<file>.
-- tests/import-original.mjs checks that the imported challenge scores exactly as the old one did.
begin;

create or replace function public.nx_import_original(p_erin uuid, p_kazzy uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  cfg record; couple uuid; c challenges; old_erin uuid; old_kazzy uuid;
begin
  if exists(select 1 from challenges where theme = 'original') then raise exception 'The original challenge is already imported.'; end if;
  select * into cfg from challenge_config where id = 1;
  select id into old_erin from challenge_profiles where name = 'Erin';
  select id into old_kazzy from challenge_profiles where name = 'Kazzy';
  if old_erin is null or old_kazzy is null then raise exception 'The old tables are missing.'; end if;

  insert into profiles(id, name, hue) values (p_erin, 'Erin', 265), (p_kazzy, 'Kazzy', 25) on conflict (id) do nothing;
  -- Into the couple the two already share (paired by an invite), or a new one if they haven't paired yet.
  select m.couple_id into couple from couple_members m
  where m.person_id = p_erin
    and exists(select 1 from couple_members x where x.couple_id = m.couple_id and x.person_id = p_kazzy)
    and (select count(*) from couple_members y where y.couple_id = m.couple_id) = 2
  order by m.joined_at desc limit 1;
  if couple is null then
    insert into couples default values returning id into couple;
    insert into couple_members(couple_id, person_id) values (couple, p_erin), (couple, p_kazzy);
  end if;
  insert into challenges(couple_id, name, look, theme, start_date, days, time_zone, deadline_days, deadline_time,
                         step, cap, week_start, status, created_by)
  values (couple, 'The Original', 'sleep', 'original', cfg.start_date, cfg.end_date - cfg.start_date + 1, 'America/Toronto',
          1, '23:59', 1, null, 1, 'running', p_erin)
  returning * into c;
  insert into signatures(challenge_id, person_id) values (c.id, p_erin), (c.id, p_kazzy);

  -- The rules, with the wording from the old app's lib/rules.ts. Weekly targets come from the rule
  -- (4 gym days a week, 3 step days), prorated in short weeks exactly as challenge_weekly_targets set them.
  create temporary table old_rule_map(old_id text, new_id uuid) on commit drop;
  with words(old_id, position, question, description, grp, weekly_target, starts_on) as (values
    ('bed', 0, 'Were you in bed by 11 pm, reading until you fell asleep?', 'Be in bed by 11 pm and read until you fall asleep.', 'Sleep', null::integer, null::date),
    ('bed_1am', 1, 'Were you in bed by 1 am, reading until you fell asleep?', 'Fridays and Saturdays: be in bed by 1 am and read until you fall asleep.', 'Sleep', null, null),
    ('screens', 2, 'Did you keep screens out of the bedroom?', 'No screens of any kind in the bedroom. Phones stay outside the room.', 'Sleep', null, null),
    ('weed', 3, 'Did you avoid smoking weed?', 'No smoking weed on Sunday through Thursday.', 'Mind', null, null),
    ('weed_daily', 4, 'Did you avoid smoking weed?', 'No smoking weed on any day, weekends included.', 'Mind', null, null),
    ('prayer', 5, 'Did you pray today?', 'At least once, every day.', 'Mind', null, null),
    ('food', 6, 'Did you avoid eating out?', 'Takeout and delivery count. Coffee is allowed.', 'Food', null, null),
    ('time', 7, 'Was your useless screen time an hour or less?', 'Social media and games count. YouTube is excluded. Attach your Screen Time screenshots.', 'Screens', null, null),
    ('entertainment', 8, 'Did you avoid entertainment before 6 pm?', 'Content before 6 pm must be educational and related to work, including YouTube.', 'Screens', null, null),
    ('steps', 9, 'Did you walk at least 10,000 steps?', 'Reach 10,000 steps and attach a step-count screenshot.', 'Movement', null, null),
    ('calories', 10, 'Did you stay within 2,300 calories and track your macros?', 'Both are required. Attach your ChatGPT macro screenshot.', 'Food', null, null),
    ('gym', 11, 'Did you go to the gym today?', 'Condo or regular gym. One visit per day, counted per Monday–Sunday week.', 'Movement', 4, null),
    ('steps_weekly', 12, 'Did you walk at least 10,000 steps today?', 'Reach 10,000 steps and attach a step-count screenshot.', 'Movement', 3, '2026-09-28'),
    ('hands', 13, 'Did you take your Sunday hands photo?', 'Sundays: a photo of your hands, showing you''ve been caring for your cuticles (fidget tool, oil, not picking).', 'Body', null, null)
  ), made as (
    insert into rules(challenge_id, position, title, question, description, rule_group, kind, days, weekly_target, who, proof, starts_on)
    select c.id, w.position, o.title, w.question, w.description, w.grp,
           case when o.weekly then 'weekly' else 'yesno' end,
           case when o.weeknights then array[0,1,2,3,4] when o.weekends then array[5,6]
                when (to_jsonb(o)->>'sundays')::boolean then array[0] else array[0,1,2,3,4,5,6] end,
           w.weekly_target,
           case o.person when 'Erin' then p_erin when 'Kazzy' then p_kazzy end,
           case when o.proof_required then 'required' else 'none' end,
           coalesce(w.starts_on, (to_jsonb(o)->>'starts')::date)
    from challenge_rules o join words w on w.old_id = o.id
    returning id, position
  )
  insert into old_rule_map select w.old_id, m.id from made m join words w on w.position = m.position;
  if (select count(*) from old_rule_map) <> (select count(*) from challenge_rules) then
    raise exception 'A rule in challenge_rules has no wording here. Add it to the list above.';
  end if;

  -- A No on a weekly day (the gym) whose forgiveness was approved, or still waiting, counted as a
  -- visit in the old app (its 'day_forgiveness' point never cost anything). The new engine counts done
  -- answers only, so such a day comes across as a confirmed visit and its free point stays behind.
  create temporary table old_forgiven_day(entry_id uuid) on commit drop;
  insert into old_forgiven_day
  select q.entry_id from challenge_points q
  where q.reason = 'day_forgiveness' and q.entry_id is not null and not q.voided
    and (q.forgiven or exists(select 1 from challenge_requests r where r.point_id = q.id and r.status = 'pending'));

  -- Answers. A screenshot path <old account>/<file> becomes <challenge>/<new account>/<file>.
  create temporary table old_entry_map(old_id uuid, new_id uuid) on commit drop;
  with src as (
    select e.*, gen_random_uuid() new_id,
           case e.user_id when old_erin then p_erin else p_kazzy end person
    from challenge_entries e
  ), moved as (
    insert into entries(id, challenge_id, person_id, rule_id, day, done, status, note, proofs, logged_at,
                        correction_done, correction_note, correction_proofs, correction_at)
    select s.new_id, c.id, s.person, m.new_id, s.day,
           case when s.id in (select entry_id from old_forgiven_day) then true
                when s.status = 'unlogged' then null else s.done end,
           case when s.id in (select entry_id from old_forgiven_day) then 'confirmed' else s.status end, s.note,
           coalesce((select jsonb_agg(jsonb_build_object('path', c.id || '/' || s.person || '/' || split_part(f, '/', 2)))
                     from unnest(string_to_array(s.proof, E'\n')) f), '[]'),
           s.updated_at,
           s.proposed_done, s.proposed_note,
           case when s.proposed_done is not null then coalesce((select jsonb_agg(jsonb_build_object('path', c.id || '/' || s.person || '/' || split_part(f, '/', 2)))
                     from unnest(string_to_array(s.proposed_proof, E'\n')) f), '[]') end,
           case when s.proposed_done is not null then s.updated_at end
    from src s join old_rule_map m on m.old_id = s.rule_id
    returning id
  )
  insert into old_entry_map select s.id, s.new_id from src s where s.new_id in (select id from moved);

  -- Points, keeping their order (which sets their price).
  create temporary table old_point_map(old_id uuid, new_id uuid) on commit drop;
  with src as (
    select p.*, gen_random_uuid() new_id,
           case p.user_id when old_erin then p_erin else p_kazzy end person
    from challenge_points p
    where p.reason <> 'day_forgiveness'
  ), moved as (
    insert into points(id, challenge_id, person_id, rule_id, day, reason, entry_id, slot, forgiven, voided, created_at)
    select s.new_id, c.id, s.person, m.new_id, s.day,
           case s.reason when 'dispute_conceded' then 'conceded' when 'weekly_shortfall' then 'weekly'
                         when 'unlogged' then 'unlogged' else 'missed' end,
           (select new_id from old_entry_map where old_id = s.entry_id), s.slot, s.forgiven, s.voided, s.created_at
    from src s join old_rule_map m on m.old_id = s.rule_id
    returning id
  )
  insert into old_point_map select s.id, s.new_id from src s where s.new_id in (select id from moved);

  insert into forgiveness_requests(challenge_id, point_id, from_id, reason, status, created_at, decided_at)
  select c.id, pm.new_id, case r.requester_id when old_erin then p_erin else p_kazzy end, r.reason,
         case r.status when 'approved' then 'approved' when 'denied' then 'denied' else 'pending' end,
         coalesce(r.decided_at, (select created_at from challenge_points where id = r.point_id)), r.decided_at
  from challenge_requests r join old_point_map pm on pm.old_id = r.point_id;

  insert into disputes(challenge_id, entry_id, raised_by, comment, status, created_at, resolved_at)
  select c.id, em.new_id, case d.raised_by when old_erin then p_erin else p_kazzy end, d.comment,
         case d.status when 'conceded' then 'conceded' when 'withdrawn' then 'withdrawn' else 'open' end,
         d.created_at, d.resolved_at
  from challenge_disputes d join old_entry_map em on em.old_id = d.entry_id;

  insert into journal_notes(challenge_id, person_id, day, text, created_at)
  select c.id, case n.user_id when old_erin then p_erin else p_kazzy end, n.day, n.text, n.created_at
  from challenge_journal_notes n;

  -- Settle the deadlines once under the new rules engine; the test checks this changes no point.
  perform nx_tick(c.id);
  return c.id;
end $$;

revoke all on function public.nx_import_original(uuid, uuid) from public, anon, authenticated;

commit;
