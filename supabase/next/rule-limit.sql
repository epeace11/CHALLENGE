-- Up to 30 rules in a challenge (November 9, 2026). It was 20, and Erin and Kazzy's next challenge
-- has 22. Only nx_put_rules counts them; Set up has no limit of its own. Rerunnable; run once on PROD
-- CHALLENGE, after timer.sql (it keeps timer.sql's version of the function, with the new limit), at any
-- time before starting a challenge with more than 20 rules. Fresh installs get the same from schema.sql.
begin;

create or replace function public.nx_put_rules(c public.challenges, p_rules jsonb) returns void language plpgsql security definer set search_path = public as $$
declare x jsonb; i integer := 0; who uuid; partner uuid := nx_partner(c.id, auth.uid());
begin
  if jsonb_typeof(p_rules) <> 'array' then raise exception 'Rules must be a list.'; end if;
  if jsonb_array_length(p_rules) > 30 then raise exception 'Keep it to 30 rules or fewer.'; end if;
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

revoke all on function public.nx_put_rules(public.challenges, jsonb) from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;

-- Shows whether it took: expect limit_is_30 = true.
select position('30 rules' in prosrc) > 0 as limit_is_30 from pg_proc where proname = 'nx_put_rules';
