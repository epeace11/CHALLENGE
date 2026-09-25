-- Change history (September 24, 2026). Run once in the Supabase SQL editor; rerunnable.
--
-- 1. challenge_scripts records every SQL script run by hand: each script ends by
--    inserting its own name, so "has this run, and when?" is one query:
--      select * from challenge_scripts order by ran_at;
-- 2. challenge_history records every change to entries, points, forgiveness
--    requests, disputes, weeks, rules and config: who made it (a member, the
--    hourly job, or a script), the statement behind it, and the row before and
--    after. Changes nobody asked for (the hourly miss job, gym scoring, one-off
--    scripts) are now as traceable as members' own actions:
--      select * from challenge_history order by at desc limit 100;
-- 3. Points get an updated_at, bumped only when a point actually changes.

create table if not exists public.challenge_scripts(name text primary key,ran_at timestamptz,runs integer not null default 1,note text);

create table if not exists public.challenge_history(id bigint generated always as identity primary key,at timestamptz not null default now(),table_name text not null,op text not null,row_id text,actor uuid,source text not null,statement text,old_row jsonb,new_row jsonb);
create index if not exists challenge_history_at on public.challenge_history(at desc);
create index if not exists challenge_history_row on public.challenge_history(table_name,row_id);

alter table public.challenge_points add column if not exists updated_at timestamptz;
update public.challenge_points set updated_at=created_at where updated_at is null;
alter table public.challenge_points alter column updated_at set default now();
alter table public.challenge_points alter column updated_at set not null;

create or replace function public.challenge_touch() returns trigger language plpgsql as $$ begin
 if new is distinct from old then new.updated_at:=now(); end if;
 return new;end $$;
drop trigger if exists challenge_points_touch on public.challenge_points;
create trigger challenge_points_touch before update on public.challenge_points for each row execute function public.challenge_touch();

-- One row per real change. Upserts that rewrite a row unchanged (the hourly gym rescore does this) are skipped.
create or replace function public.challenge_record() returns trigger language plpgsql security definer set search_path=public as $$
declare o jsonb:=case when tg_op<>'INSERT' then to_jsonb(old) end;n jsonb:=case when tg_op<>'DELETE' then to_jsonb(new) end;who uuid:=auth.uid();begin
 if tg_op='UPDATE' and (o-'updated_at')=(n-'updated_at') then return null; end if;
 insert into challenge_history(table_name,op,row_id,actor,source,statement,old_row,new_row)
 values(tg_table_name,lower(tg_op),coalesce(n,o)->>coalesce((select k from unnest(array['id','start_date','user_id']) k where coalesce(n,o) ? k limit 1),'id'),who,
  case when who is not null then 'member' else coalesce(nullif(current_setting('application_name',true),''),'unknown') end,
  left(current_query(),1000),o,n);
 return null;end $$;

do $$ declare t text;begin
 foreach t in array array['challenge_entries','challenge_points','challenge_requests','challenge_disputes','challenge_weeks','challenge_rules','challenge_config'] loop
  execute format('drop trigger if exists %I on public.%I',t||'_record',t);
  execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.challenge_record()',t||'_record',t);
 end loop;end $$;

-- Members can read both logs; nobody writes them directly.
alter table public.challenge_scripts enable row level security;
alter table public.challenge_history enable row level security;
drop policy if exists scripts_member_read on public.challenge_scripts;
create policy scripts_member_read on public.challenge_scripts for select to authenticated using(public.challenge_member());
drop policy if exists history_member_read on public.challenge_history;
create policy history_member_read on public.challenge_history for select to authenticated using(public.challenge_member());
grant select on public.challenge_scripts,public.challenge_history to authenticated;
revoke insert,update,delete on public.challenge_scripts,public.challenge_history from anon,authenticated;
revoke all on function public.challenge_record(),public.challenge_touch() from public,anon,authenticated;

-- Tonight's two scripts ran before this log existed.
insert into public.challenge_scripts(name,ran_at,note) values
 ('fix-deadline-1159pm.sql',null,'Ran September 24, 2026, before script tracking'),
 ('gym-weeks-mon-sun.sql',null,'Ran September 24, 2026, before script tracking')
on conflict(name) do nothing;

insert into public.challenge_scripts(name,ran_at) values('change-history.sql',now()) on conflict(name) do update set ran_at=now(),runs=challenge_scripts.runs+1;
