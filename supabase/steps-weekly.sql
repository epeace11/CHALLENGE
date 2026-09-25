-- Kazzy's weekly steps rule, and weekly targets in one table (September 24, 2026).
-- Run once in the Supabase SQL editor, after change-history.sql; safe to rerun.
--
-- challenge_weekly_targets now holds every weekly rule's target per week, and the app
-- reads it, so changing a target is one row here. The gym targets move into it from
-- challenge_weeks.target, which is then dropped. New rule steps_weekly (Kazzy, screenshot
-- required): Sep 21–27 needs 1 day, Sep 28–Oct 4 and Oct 5–11 need 3, Oct 12–14 needs 1.
-- The scoring, hourly, logging and review functions treat every weekly rule like the gym.

create table if not exists public.challenge_weekly_targets(rule_id text not null references public.challenge_rules,start_date date not null references public.challenge_weeks,target integer not null check(target>=0),primary key(rule_id,start_date));
alter table public.challenge_weekly_targets enable row level security;
drop policy if exists member_read on public.challenge_weekly_targets;
create policy member_read on public.challenge_weekly_targets for select to authenticated using(public.challenge_member());
grant select on public.challenge_weekly_targets to authenticated;
revoke insert,update,delete on public.challenge_weekly_targets from anon,authenticated;
drop trigger if exists challenge_weekly_targets_record on public.challenge_weekly_targets;
create trigger challenge_weekly_targets_record after insert or update or delete on public.challenge_weekly_targets for each row execute function public.challenge_record();

insert into public.challenge_rules(id,title,person,weeknights,proof_required,weekly,weekends) values('steps_weekly','10,000 steps, 3 days a week','Kazzy',false,true,true,false) on conflict(id) do nothing;

do $$ begin
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='challenge_weeks' and column_name='target') then
  insert into public.challenge_weekly_targets(rule_id,start_date,target) select 'gym',start_date,target from public.challenge_weeks on conflict do nothing;
  alter table public.challenge_weeks drop column target;
 end if;
end $$;
insert into public.challenge_weekly_targets values('steps_weekly','2026-09-21',1),('steps_weekly','2026-09-28',3),('steps_weekly','2026-10-05',3),('steps_weekly','2026-10-12',1) on conflict(rule_id,start_date) do update set target=excluded.target;

create or replace function public.challenge_rescore() returns void language plpgsql security definer set search_path=public as $$ declare w record;p record;n integer;i integer;begin
 for w in select k.start_date,k.end_date,t.rule_id,t.target from challenge_weeks k join challenge_weekly_targets t using(start_date) join challenge_rules r on r.id=t.rule_id where r.weekly and ((k.end_date+1)+time '23:59') at time zone 'America/Toronto'<=now() loop
 for p in select pr.* from challenge_profiles pr join challenge_rules r on r.id=w.rule_id where r.person is null or r.person=pr.name loop
 select greatest(0,w.target-count(*)::integer) into n from challenge_entries where user_id=p.id and rule_id=w.rule_id and day between w.start_date and w.end_date and done and status not in ('conceded','missed','unlogged');
 for i in 1..w.target loop
 insert into challenge_points(user_id,rule_id,day,reason,slot,voided) values(p.id,w.rule_id,w.end_date,'weekly_shortfall',i,i>n) on conflict(user_id,rule_id,day,slot) do update set voided=excluded.voided;
 end loop;end loop;end loop;end $$;

create or replace function public.challenge_tick() returns void language plpgsql security definer set search_path=public as $$ begin
 perform pg_advisory_xact_lock(8092026);
 if (select finalized from challenge_config where id=1) then return; end if;
 insert into challenge_entries(user_id,rule_id,day,done,status)
 select p.id,r.id,d::date,false,'unlogged' from challenge_config c cross join challenge_profiles p cross join challenge_rules r cross join lateral generate_series(c.start_date::timestamp,least(c.end_date,((now() at time zone 'America/Toronto')-interval '23 hours 59 minutes')::date-1)::timestamp,interval '1 day') d
 where not r.weekly and (r.person is null or r.person=p.name) and (not r.weeknights or extract(dow from d)<=4) and (not r.weekends or extract(dow from d)>4) on conflict do nothing;
 insert into challenge_points(user_id,rule_id,day,reason,entry_id) select user_id,rule_id,day,'unlogged',id from challenge_entries where status='unlogged' and rule_id not in (select id from challenge_rules where weekly) on conflict do nothing;
 update challenge_entries set status='confirmed' where status='pending' and proposed_done is null and updated_at<=now()-interval '48 hours';
 perform challenge_rescore();end $$;

create or replace function public.challenge_log(p_rule text,p_day date,p_done boolean,p_note text default '',p_proof text default null) returns void language plpgsql security definer set search_path=public as $$ declare r challenge_rules;e challenge_entries;late boolean; begin
 perform challenge_assert(); perform challenge_tick(); select * into r from challenge_rules where id=p_rule;
 if r.id is null or p_day not between (select start_date from challenge_config) and (select least(end_date,(now() at time zone 'America/Toronto')::date-case when allow_same_day then 0 else 1 end) from challenge_config) or (r.person is not null and r.person<>(select name from challenge_profiles where id=auth.uid())) or (r.weekly and coalesce((select t.target from challenge_weekly_targets t join challenge_weeks k using(start_date) where t.rule_id=r.id and p_day between k.start_date and k.end_date),0)=0) or (r.weeknights and extract(dow from p_day)>4) or (r.weekends and extract(dow from p_day)<=4) then raise exception 'This habit is not available for that date.'; end if;
 if p_done and r.proof_required and p_proof is null then raise exception 'Attach a screenshot first.'; end if;
 if p_proof is not null and cardinality(string_to_array(p_proof,E'\n'))>6 then raise exception 'Attach at most six screenshots.'; end if;
 if p_proof is not null and exists(select 1 from unnest(string_to_array(p_proof,E'\n')) as f(path) where not exists(select 1 from storage.objects where bucket_id='challenge-proof' and name=f.path and (storage.foldername(f.path))[1]=auth.uid()::text)) then raise exception 'Invalid proof attachment.'; end if;
 select * into e from challenge_entries where user_id=auth.uid() and rule_id=p_rule and day=p_day;
 if e.status='disputed' then raise exception 'Resolve the dispute before editing.'; end if;
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

create or replace function public.challenge_review(p_entry uuid,p_action text,p_comment text default '') returns void language plpgsql security definer set search_path=public as $$ declare e challenge_entries;d challenge_disputes;begin
 perform challenge_assert();select * into e from challenge_entries where id=p_entry for update;if e.id is null then raise exception 'Entry not found';end if;
 if p_action in ('approve','dispute','reject_correction') then
 if e.user_id=auth.uid() then raise exception 'Only your partner can review this.';end if;
 if p_action='approve' then
 if e.status<>'pending' and e.proposed_done is null then raise exception 'This entry is not awaiting approval.';end if;
 update challenge_entries set done=coalesce(proposed_done,done),note=coalesce(proposed_note,note),proof=case when proposed_done is not null then proposed_proof else proof end,status=case when coalesce(proposed_done,done) then 'confirmed' else 'missed' end,proposed_done=null,proposed_note=null,proposed_proof=null where id=e.id returning * into e;
 if not (select weekly from challenge_rules where id=e.rule_id) then insert into challenge_points(user_id,rule_id,day,reason,entry_id,voided) values(e.user_id,e.rule_id,e.day,'missed',e.id,e.done) on conflict(user_id,rule_id,day,slot) do update set voided=excluded.voided;end if;
 elsif p_action='reject_correction' then update challenge_entries set proposed_done=null,proposed_note=null,proposed_proof=null where id=e.id;
 else
 if e.status<>'pending' or e.proposed_done is not null or length(trim(p_comment))=0 then raise exception 'A pending entry and dispute reason are required.';end if;
 insert into challenge_disputes(entry_id,raised_by,comment) values(e.id,auth.uid(),left(p_comment,2000)); update challenge_entries set status='disputed' where id=e.id;
 end if;
 elsif p_action in ('concede','withdraw') then
 select * into d from challenge_disputes where entry_id=e.id and status='open' for update;
 if d.id is null or (p_action='concede' and e.user_id<>auth.uid()) or (p_action='withdraw' and d.raised_by<>auth.uid()) then raise exception 'You cannot resolve this dispute that way.';end if;
 update challenge_disputes set status=case when p_action='concede' then 'conceded' else 'withdrawn' end,resolved_at=now() where id=d.id;
 update challenge_entries set status=case when p_action='concede' then 'conceded' else 'confirmed' end,done=p_action<>'concede' where id=e.id;
 if p_action='concede' and not (select weekly from challenge_rules where id=e.rule_id) then insert into challenge_points(user_id,rule_id,day,reason,entry_id) values(e.user_id,e.rule_id,e.day,'dispute_conceded',e.id) on conflict(user_id,rule_id,day,slot) do update set voided=false,reason='dispute_conceded';end if;
 else raise exception 'Unknown review action';end if;
 insert into challenge_audit(entry_id,actor,action,details) values(e.id,auth.uid(),p_action,jsonb_build_object('comment',p_comment));delete from challenge_finalizations where true;perform challenge_rescore();end $$;

select public.challenge_rescore();

insert into public.challenge_scripts(name,ran_at) values('steps-weekly.sql',now()) on conflict(name) do update set ran_at=now(),runs=challenge_scripts.runs+1;

select * from public.challenge_weekly_targets order by start_date,rule_id;
