-- Daily journal: one free-text entry per person per day, readable by both members.
-- Writes go through challenge_journal, which checks membership and the challenge dates.
-- Journals never affect scoring, so they can be written or edited at any time. Safe to rerun.
create table if not exists public.challenge_journals(user_id uuid not null references public.challenge_profiles,day date not null,text text not null default '',updated_at timestamptz not null default now(),primary key(user_id,day));
alter table public.challenge_journals enable row level security;
drop policy if exists journal_member_read on public.challenge_journals;
create policy journal_member_read on public.challenge_journals for select to authenticated using(public.challenge_member());
grant select on public.challenge_journals to authenticated;
revoke insert,update,delete on public.challenge_journals from anon,authenticated;
create or replace function public.challenge_journal(p_day date,p_text text) returns void language plpgsql security definer set search_path=public as $$ begin
 if not challenge_member() then raise exception 'This challenge is only for Erin and Kazzy.'; end if;
 if p_day not between (select start_date from challenge_config) and (select end_date from challenge_config) then raise exception 'That day is outside the challenge.'; end if;
 if length(coalesce(p_text,''))>4000 then raise exception 'Keep the journal under 4,000 characters.'; end if;
 insert into challenge_journals(user_id,day,text) values(auth.uid(),p_day,coalesce(p_text,'')) on conflict(user_id,day) do update set text=excluded.text,updated_at=now();
end $$;
revoke all on function public.challenge_journal(date,text) from public,anon;
grant execute on function public.challenge_journal(date,text) to authenticated;
