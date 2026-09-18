-- Kazzy's rule changes (September 18, 2026). Run once in the Supabase SQL editor; rerunnable.
--   bed        -> shared, unchanged: in bed by 11 pm, Sun–Thu, for both
--   bed_1am    -> new, Kazzy only, Fri–Sat: "Weekends: in bed by 1 am, then read until you sleep"
--   weed       -> Erin only, unchanged (Sun–Thu)
--   weed_daily -> new, Kazzy only, every day including Fri/Sat: "No smoking weed, all week"
-- Adds the `weekends` flag (Fri/Sat only, the mirror of `weeknights`) and teaches the hourly job and the
-- logging function about it. Kazzy's existing weed entries and points move to weed_daily so history and
-- totals are kept. Also undoes an earlier draft of this script that had moved his weekday bed rows to
-- bed_1am and marked bed as Erin's. Runs under the same advisory lock as the hourly job.
begin;
select pg_advisory_xact_lock(8092026);

alter table public.challenge_rules add column if not exists weekends boolean not null default false;

insert into public.challenge_rules(id,title,person,weeknights,proof_required,weekly,weekends) values
 ('bed_1am','Weekends: in bed by 1 am, then read until you sleep','Kazzy',false,false,false,true),
 ('weed_daily','No smoking weed, all week','Kazzy',false,false,false,false)
on conflict(id) do update set title=excluded.title,person=excluded.person,weeknights=excluded.weeknights,weekends=excluded.weekends;
update public.challenge_rules set person=null where id='bed';
update public.challenge_rules set person='Erin' where id='weed';

-- Undo the earlier draft: weekday bed rows belong on the shared rule.
update public.challenge_entries set rule_id='bed' where rule_id='bed_1am' and extract(dow from day)<=4;
update public.challenge_points set rule_id='bed' where rule_id='bed_1am' and extract(dow from day)<=4;

update public.challenge_entries set rule_id='weed_daily' where rule_id='weed' and user_id=(select id from public.challenge_profiles where name='Kazzy');
update public.challenge_points set rule_id='weed_daily' where rule_id='weed' and user_id=(select id from public.challenge_profiles where name='Kazzy');

create or replace function public.challenge_tick() returns void language plpgsql security definer set search_path=public as $$ begin
 perform pg_advisory_xact_lock(8092026);
 if (select finalized from challenge_config where id=1) then return; end if;
 insert into challenge_entries(user_id,rule_id,day,done,status)
 select p.id,r.id,d::date,false,'unlogged' from challenge_config c cross join challenge_profiles p cross join challenge_rules r cross join lateral generate_series(c.start_date::timestamp,least(c.end_date,((now() at time zone 'America/Toronto')-interval '18 hours')::date-1)::timestamp,interval '1 day') d
 where not r.weekly and (r.person is null or r.person=p.name) and (not r.weeknights or extract(dow from d)<=4) and (not r.weekends or extract(dow from d)>4) on conflict do nothing;
 insert into challenge_points(user_id,rule_id,day,reason,entry_id) select user_id,rule_id,day,'unlogged',id from challenge_entries where status='unlogged' and rule_id<>'gym' on conflict do nothing;
 update challenge_entries set status='confirmed' where status='pending' and proposed_done is null and updated_at<=now()-interval '48 hours';
 perform challenge_rescore();end $$;

create or replace function public.challenge_log(p_rule text,p_day date,p_done boolean,p_note text default '',p_proof text default null) returns void language plpgsql security definer set search_path=public as $$ declare r challenge_rules;e challenge_entries;late boolean; begin
 perform challenge_assert(); perform challenge_tick(); select * into r from challenge_rules where id=p_rule;
 if r.id is null or p_day not between (select start_date from challenge_config) and (select least(end_date,(now() at time zone 'America/Toronto')::date-case when allow_same_day then 0 else 1 end) from challenge_config) or (r.person is not null and r.person<>(select name from challenge_profiles where id=auth.uid())) or (r.weeknights and extract(dow from p_day)>4) or (r.weekends and extract(dow from p_day)<=4) then raise exception 'This habit is not available for that date.'; end if;
 if p_done and r.proof_required and p_proof is null then raise exception 'Attach a screenshot first.'; end if;
 if p_proof is not null and cardinality(string_to_array(p_proof,E'\n'))>6 then raise exception 'Attach at most six screenshots.'; end if;
 if p_proof is not null and exists(select 1 from unnest(string_to_array(p_proof,E'\n')) as f(path) where not exists(select 1 from storage.objects where bucket_id='challenge-proof' and name=f.path and (storage.foldername(f.path))[1]=auth.uid()::text)) then raise exception 'Invalid proof attachment.'; end if;
 select * into e from challenge_entries where user_id=auth.uid() and rule_id=p_rule and day=p_day;
 if e.status='disputed' then raise exception 'Resolve the dispute before editing.'; end if;
 late:=now()>((p_day+1)+time '18:00') at time zone 'America/Toronto';
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

select public.challenge_rescore();
commit;

-- Sanity check: bed shared, weed Erin's, bed_1am weekend-only for Kazzy, weed_daily every day for Kazzy; no Kazzy rows left on weed.
select id,title,person,weeknights,weekends from public.challenge_rules where id in ('bed','bed_1am','weed','weed_daily') order by id;
select count(*) as kazzy_rows_on_weed from public.challenge_entries e join public.challenge_profiles p on p.id=e.user_id where p.name='Kazzy' and e.rule_id='weed';
select count(*) as weekday_rows_on_bed_1am from public.challenge_entries where rule_id='bed_1am' and extract(dow from day)<=4;
