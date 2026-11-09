-- Goals (November 9, 2026): each person writes a few goals for a challenge, in their own words, to keep
-- them going. Their Overview shows them; the partner reads them one tap away. Nothing is scored.
-- Rerunnable; run once on PROD CHALLENGE, after rule-limit.sql, BEFORE deploying the app that uses it
-- (the app listens for live changes to goals, which needs the table). Fresh installs get the same from
-- schema.sql.
begin;

create table if not exists public.goals(
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges on delete cascade,
  person_id uuid not null references public.profiles on delete cascade,
  position integer not null default 0,
  text text not null check (length(trim(text)) between 1 and 100),
  created_at timestamptz not null default now()
);
create index if not exists goals_challenge on public.goals(challenge_id, person_id, position);

alter table public.goals enable row level security;
grant select on public.goals to authenticated;
revoke insert, update, delete on public.goals from anon, authenticated;
drop policy if exists read_own on public.goals;
create policy read_own on public.goals for select to authenticated using (nx_in_challenge(challenge_id));

-- The viewer's goals for a challenge, replacing the ones they had, in order: trimmed, empty ones
-- left out, at most 5 of 100 characters each (setGoals in lib/next/actions.ts does the same). Only
-- the viewer's own; the partner reads them. Any time, before Day 1 or after.
create or replace function public.nx_set_goals(p_challenge uuid, p_goals jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge); g text; i integer := 0;
begin
  if jsonb_typeof(coalesce(p_goals, '[]')) <> 'array' then raise exception 'Goals must be a list.'; end if;
  delete from goals where challenge_id = c.id and person_id = auth.uid();
  for g in select left(trim(v), 100) from jsonb_array_elements_text(coalesce(p_goals, '[]')) v loop
    continue when g = '';
    exit when i >= 5;
    insert into goals(challenge_id, person_id, position, text) values (c.id, auth.uid(), i, g);
    i := i + 1;
  end loop;
end $$;

revoke all on function public.nx_set_goals(uuid, jsonb) from public, anon;
grant execute on function public.nx_set_goals(uuid, jsonb) to authenticated;

do $$ begin
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'goals') then
    alter publication supabase_realtime add table public.goals;
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
