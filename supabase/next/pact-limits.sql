-- The pact and Day 1, and limits of your own (November 3, 2026). Rerunnable; run once on PROD CHALLENGE,
-- after end-requests.sql. Fresh installs get the same from schema.sql.
--
-- 1. Finishing setup no longer signs (nx_finish_setup): the person who set it up reads the pact and
--    signs it like their partner, then sends the invite.
-- 2. Day 1 is never before the day after both signed (nx_sign_pact): signing late used to make the
--    signing day itself Day 1.
-- 3. A number rule can let each person set their own target, like a calorie limit (rules.personal and
--    rules.limits): each sets theirs when they sign (nx_sign_pact's p_limits), and their answers are
--    checked against it (nx_meets, nx_save_checkin). Saving a challenge keeps the rule personal.
begin;

alter table public.rules add column if not exists personal boolean not null default false;
alter table public.rules add column if not exists limits jsonb not null default '{}';

-- Both take a new argument, which create or replace can't do.
drop function if exists public.nx_sign_pact(uuid);
drop function if exists public.nx_meets(public.rules, numeric);

-- Replaces a challenge's rules from a JSON array of Rule objects (lib/next/model.ts). `who` is
-- 'both', 'me' (the caller), 'partner', or a member's id.
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
                      target_op, target_value, target_unit, who, for_invitee, proof, starts_on, ends_on, personal, limits)
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
            else '{}' end);
    i := i + 1;
  end loop;
end $$;

-- Setup is done and the pact opens: the viewer reads it and signs (nx_sign_pact), then invites the
-- partner, or, with the partner already in the couple, waits for them to sign.
create or replace function public.nx_finish_setup(p_challenge uuid) returns void language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge);
begin
  if c.status not in ('draft','invited','signing') then raise exception 'This challenge has started.'; end if;
  if not exists(select 1 from rules where challenge_id = c.id) then raise exception 'Add at least one rule.'; end if;
  if c.status = 'draft' then
    update challenges set status = case when nx_partner(c.id, auth.uid()) is null then 'invited' else 'signing' end where id = c.id;
  end if;
end $$;

-- Signs the pact, with the signer's own limits as {rule id: value} for the rules where each person
-- sets their own. A limit is set once, with the signature. Once both have signed, the challenge is running.
create or replace function public.nx_sign_pact(p_challenge uuid, p_limits jsonb default null) returns void language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge); k text; v jsonb; r rules;
begin
  if c.status not in ('invited','signing') then raise exception 'There''s nothing to sign right now.'; end if;
  if exists(select 1 from signatures where challenge_id = c.id and person_id = auth.uid()) then return; end if;
  if jsonb_typeof(p_limits) = 'object' then
    for k, v in select l.key, l.value from jsonb_each(p_limits) l loop
      select * into r from rules where challenge_id = c.id and id::text = k;
      if r.id is null or not r.personal or not nx_rule_for(r, auth.uid()) then raise exception 'That rule has no limit of your own.'; end if;
      if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric <= 0 then raise exception 'Enter your limit first.'; end if;
      update rules set limits = limits || jsonb_build_object(auth.uid()::text, v) where id = r.id;
    end loop;
  end if;
  insert into signatures(challenge_id, person_id) values (c.id, auth.uid());
  if c.status = 'signing' and (select count(*) from signatures where challenge_id = c.id) = 2 then
    -- Day 1 is never before the day after both signed: nobody starts a day already under way.
    update challenges set status = 'running', start_date = greatest(start_date, nx_today(c) + 1) where id = c.id;
  end if;
end $$;

-- Whether `p_value` meets the rule's target for `p_person`: their own limit on a personal rule.
create or replace function public.nx_meets(r public.rules, p_value numeric, p_person uuid) returns boolean language sql immutable as $$
  select case r.target_op
    when '>=' then p_value >= coalesce((r.limits->>p_person::text)::numeric, r.target_value)
    when '<=' then p_value <= coalesce((r.limits->>p_person::text)::numeric, r.target_value)
    else false end
$$;

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
      'proof', r.proof, 'personalTarget', case when r.personal then true end)) order by r.position)
    from rules r where r.challenge_id = c.id), '[]'), auth.uid())
  returning id into s;
  return s;
end $$;

revoke all on function public.nx_sign_pact(uuid, jsonb) from public, anon;
grant execute on function public.nx_sign_pact(uuid, jsonb) to authenticated;

commit;
