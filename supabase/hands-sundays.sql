-- Erin's Sunday hands photo (October 6, 2026). Run once in the Supabase SQL editor, BEFORE deploying
-- the app version that asks it; rerunnable.
--
-- A new habit for Erin, asked on Sundays only, starting Sunday Oct 11: a photo of her hands each
-- week, counted as a Yes when she has been working on her cuticles (fidget tool, oil, trying not to
-- pick). It is scored like any other daily habit: a Yes needs the photo and Kazzy's review, and a No
-- or no answer by Monday 11:59 pm is a point. Rules gain two columns for it: `sundays` (asked on
-- Sundays only, like `weeknights` and `weekends`) and `starts` (no answers or misses before that
-- day, so past Sundays stay untouched). The hourly job, logging and reminders learn both.
begin;

alter table public.challenge_rules add column if not exists sundays boolean not null default false;
alter table public.challenge_rules add column if not exists starts date;
insert into public.challenge_rules(id,title,person,weeknights,proof_required,weekly,weekends,sundays,starts) values('hands','Sunday hands photo: cuticle care','Erin',false,true,false,false,true,'2026-10-11') on conflict(id) do update set title=excluded.title,person=excluded.person,weeknights=false,proof_required=true,weekly=false,weekends=false,sundays=true,starts=excluded.starts;
create or replace function public.challenge_tick() returns void language plpgsql security definer set search_path=public as $$ begin
 perform pg_advisory_xact_lock(8092026);
 if (select finalized from challenge_config where id=1) then return; end if;
 insert into challenge_entries(user_id,rule_id,day,done,status)
 select p.id,r.id,d::date,false,'unlogged' from challenge_config c cross join challenge_profiles p cross join challenge_rules r cross join lateral generate_series(c.start_date::timestamp,least(c.end_date,((now() at time zone 'America/Toronto')-interval '23 hours 59 minutes')::date-1)::timestamp,interval '1 day') d
 where not r.weekly and (r.person is null or r.person=p.name) and (not r.weeknights or extract(dow from d)<=4) and (not r.weekends or extract(dow from d)>4) and (not r.sundays or extract(dow from d)=0) and (r.starts is null or d>=r.starts) on conflict do nothing;
 insert into challenge_points(user_id,rule_id,day,reason,entry_id) select user_id,rule_id,day,'unlogged',id from challenge_entries where status='unlogged' and rule_id not in (select id from challenge_rules where weekly) on conflict do nothing;
 update challenge_entries set status='confirmed' where status='pending' and proposed_done is null and updated_at<=now()-interval '48 hours';
 perform challenge_rescore();end $$;
create or replace function public.challenge_log(p_rule text,p_day date,p_done boolean,p_note text default '',p_proof text default null) returns void language plpgsql security definer set search_path=public as $$ declare r challenge_rules;e challenge_entries;late boolean; begin
 perform challenge_assert(); perform challenge_tick(); select * into r from challenge_rules where id=p_rule;
 if r.id is null or p_day not between (select start_date from challenge_config) and (select least(end_date,(now() at time zone 'America/Toronto')::date-case when allow_same_day then 0 else 1 end) from challenge_config) or (r.person is not null and r.person<>(select name from challenge_profiles where id=auth.uid())) or (r.weekly and coalesce((select t.target from challenge_weekly_targets t join challenge_weeks k using(start_date) where t.rule_id=r.id and p_day between k.start_date and k.end_date),0)=0) or (r.weeknights and extract(dow from p_day)>4) or (r.weekends and extract(dow from p_day)<=4) or (r.sundays and extract(dow from p_day)<>0) or (r.starts is not null and p_day<r.starts) then raise exception 'This habit is not available for that date.'; end if;
 if p_done and r.proof_required and p_proof is null then raise exception 'Attach a screenshot first.'; end if;
 if p_proof is not null and cardinality(string_to_array(p_proof,E'\n'))>6 then raise exception 'Attach at most six screenshots.'; end if;
 if p_proof is not null and exists(select 1 from unnest(string_to_array(p_proof,E'\n')) as f(path) where not exists(select 1 from storage.objects where bucket_id='challenge-proof' and name=f.path and (storage.foldername(f.path))[1]=auth.uid()::text)) then raise exception 'Invalid proof attachment.'; end if;
 select * into e from challenge_entries where user_id=auth.uid() and rule_id=p_rule and day=p_day;
 if e.status='disputed' then raise exception 'Resolve the dispute before editing.'; end if;
 if challenge_locked(e) then raise exception 'This answer is locked in.'; end if;
 late:=now()>((p_day+1)+time '23:59') at time zone 'America/Toronto';
 if late and e.id is null then
 insert into challenge_entries(user_id,rule_id,day,done,status) values(auth.uid(),p_rule,p_day,false,'unlogged') returning * into e;
 end if;
 if late and e.id is not null then
 update challenge_entries set proposed_done=p_done,proposed_note=left(p_note,2000),proposed_proof=p_proof,updated_at=now() where id=e.id;
 else
 insert into challenge_entries(user_id,rule_id,day,done,status,note,proof) values(auth.uid(),p_rule,p_day,p_done,case when p_done then 'pending' else 'missed' end,left(p_note,2000),p_proof) on conflict(user_id,rule_id,day) do update set done=excluded.done,status=excluded.status,note=excluded.note,proof=excluded.proof,updated_at=now() returning * into e;
 if not r.weekly then
 insert into challenge_points(user_id,rule_id,day,reason,entry_id,voided) values(auth.uid(),p_rule,p_day,'missed',e.id,p_done) on conflict(user_id,rule_id,day,slot) do update set voided=excluded.voided;
 end if;end if;
 insert into challenge_audit(entry_id,actor,action,details) values(e.id,auth.uid(),'log',jsonb_build_object('done',p_done,'late',late));
 delete from challenge_finalizations where true;perform challenge_rescore();end $$;
create or replace function public.challenge_reminders() returns table(user_id uuid,name text,day date,missing integer,titles text[]) language sql stable security definer set search_path=public as $$
 with c as (select start_date,end_date,finalized,(now() at time zone 'America/Toronto')::date-1 as day from challenge_config where id=1)
 select p.id,p.name,c.day,count(*)::integer,array_agg(r.title order by r.id)
 from c cross join challenge_profiles p join challenge_rules r on (r.person is null or r.person=p.name)
 where not c.finalized and c.day between c.start_date and c.end_date and not r.weekly
  and (not r.weeknights or extract(dow from c.day)<=4) and (not r.weekends or extract(dow from c.day)>4) and (not r.sundays or extract(dow from c.day)=0) and (r.starts is null or c.day>=r.starts)
  and not exists(select 1 from challenge_entries e where e.user_id=p.id and e.rule_id=r.id and e.day=c.day)
 group by p.id,p.name,c.day $$;
revoke all on function public.challenge_tick() from public,anon,authenticated;
revoke all on function public.challenge_reminders() from public,anon,authenticated;
grant execute on function public.challenge_reminders() to service_role;

insert into public.challenge_scripts(name,ran_at) values('hands-sundays.sql',now()) on conflict(name) do update set ran_at=now(),runs=challenge_scripts.runs+1;
commit;
