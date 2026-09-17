-- Journal, take two: any number of notes per person per day, each timestamped, shown together
-- when you open the day. Replaces the single-text challenge_journals table from add-journal.sql,
-- carrying over anything already written. Safe to rerun on a project with or without the old table.
create table if not exists public.challenge_journal_notes(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.challenge_profiles,day date not null,text text not null check(length(text) between 1 and 4000),created_at timestamptz not null default now());
create index if not exists challenge_journal_notes_day on public.challenge_journal_notes(user_id,day,created_at);
alter table public.challenge_journal_notes enable row level security;
drop policy if exists journal_notes_member_read on public.challenge_journal_notes;
create policy journal_notes_member_read on public.challenge_journal_notes for select to authenticated using(public.challenge_member());
grant select on public.challenge_journal_notes to authenticated;
revoke insert,update,delete on public.challenge_journal_notes from anon,authenticated;
create or replace function public.challenge_journal_add(p_day date,p_text text) returns uuid language plpgsql security definer set search_path=public as $$ declare n uuid; begin
 if not challenge_member() then raise exception 'This challenge is only for Erin and Kazzy.'; end if;
 if p_day not between (select start_date from challenge_config) and (select end_date from challenge_config) then raise exception 'That day is outside the challenge.'; end if;
 if length(trim(coalesce(p_text,'')))=0 then raise exception 'Write something first.'; end if;
 if length(p_text)>4000 then raise exception 'Keep each note under 4,000 characters.'; end if;
 insert into challenge_journal_notes(user_id,day,text) values(auth.uid(),p_day,trim(p_text)) returning id into n; return n;
end $$;
create or replace function public.challenge_journal_delete(p_id uuid) returns void language plpgsql security definer set search_path=public as $$ begin
 if not challenge_member() then raise exception 'This challenge is only for Erin and Kazzy.'; end if;
 delete from challenge_journal_notes where id=p_id and user_id=auth.uid();
 if not found then raise exception 'You can only remove your own notes.'; end if;
end $$;
revoke all on function public.challenge_journal_add(date,text),public.challenge_journal_delete(uuid) from public,anon;
grant execute on function public.challenge_journal_add(date,text),public.challenge_journal_delete(uuid) to authenticated;
-- Carry over the single-text journals, then retire the old table and function.
do $$ begin
 if to_regclass('public.challenge_journals') is not null then
  insert into challenge_journal_notes(user_id,day,text,created_at) select user_id,day,text,updated_at from challenge_journals j where length(trim(text))>0 and not exists(select 1 from challenge_journal_notes n where n.user_id=j.user_id and n.day=j.day and n.text=j.text);
  drop table public.challenge_journals;
 end if;
end $$;
drop function if exists public.challenge_journal(date,text);
