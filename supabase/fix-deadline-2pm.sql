-- Move the daily logging deadline from noon to 2 pm Toronto time.
-- Replaces four function bodies; safe to rerun; changes no data.

create or replace function public.challenge_rescore() returns void language plpgsql security definer set search_path=public as $$ declare w record;p record;n integer;i integer;begin
 for w in select * from challenge_weeks where ((end_date+1)+time '14:00') at time zone 'America/Toronto'<=now() loop
 for p in select * from challenge_profiles loop
 select greatest(0,w.target-count(*)::integer) into n from challenge_entries where user_id=p.id and rule_id='gym' and day between w.start_date and w.end_date and done and status not in ('conceded','missed','unlogged');
 for i in 1..w.target loop
 insert into challenge_points(user_id,rule_id,day,reason,slot,voided) values(p.id,'gym',w.end_date,'weekly_shortfall',i,i>n) on conflict(user_id,rule_id,day,slot) do update set voided=excluded.voided;
 end loop;end loop;end loop;end $$;

create or replace function public.challenge_tick() returns void language plpgsql security definer set search_path=public as $$ begin
 perform pg_advisory_xact_lock(8092026);
 if (select finalized from challenge_config where id=1) then return; end if;
 insert into challenge_entries(user_id,rule_id,day,done,status)
 select p.id,r.id,d::date,false,'unlogged' from challenge_config c cross join challenge_profiles p cross join challenge_rules r cross join lateral generate_series(c.start_date::timestamp,least(c.end_date,((now() at time zone 'America/Toronto')-interval '14 hours')::date-1)::timestamp,interval '1 day') d
 where not r.weekly and (r.person is null or r.person=p.name) and (not r.weeknights or extract(dow from d)<=4) on conflict do nothing;
 insert into challenge_points(user_id,rule_id,day,reason,entry_id) select user_id,rule_id,day,'unlogged',id from challenge_entries where status='unlogged' and rule_id<>'gym' on conflict do nothing;
 update challenge_entries set status='confirmed' where status='pending' and proposed_done is null and updated_at<=now()-interval '48 hours';
 perform challenge_rescore();end $$;

create or replace function public.challenge_log(p_rule text,p_day date,p_done boolean,p_note text default '',p_proof text default null) returns void language plpgsql security definer set search_path=public as $$ declare r challenge_rules;e challenge_entries;late boolean; begin
 perform challenge_assert(); perform challenge_tick(); select * into r from challenge_rules where id=p_rule;
 if r.id is null or p_day not between (select start_date from challenge_config) and (select least(end_date,(now() at time zone 'America/Toronto')::date-case when allow_same_day then 0 else 1 end) from challenge_config) or (r.person is not null and r.person<>(select name from challenge_profiles where id=auth.uid())) or (r.weeknights and extract(dow from p_day)>4) then raise exception 'This habit is not available for that date.'; end if;
 if p_done and r.proof_required and p_proof is null then raise exception 'Attach a screenshot first.'; end if;
 if p_proof is not null and not exists(select 1 from storage.objects where bucket_id='challenge-proof' and name=p_proof and (storage.foldername(name))[1]=auth.uid()::text) then raise exception 'Invalid proof attachment.'; end if;
 select * into e from challenge_entries where user_id=auth.uid() and rule_id=p_rule and day=p_day;
 if e.status='disputed' then raise exception 'Resolve the dispute before editing.'; end if;
 late:=now()>((p_day+1)+time '14:00') at time zone 'America/Toronto';
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

create or replace function public.challenge_finalize() returns void language plpgsql security definer set search_path=public as $$ begin
 perform challenge_assert();perform challenge_tick();
 if now()<((select end_date+1 from challenge_config)+time '14:00') at time zone 'America/Toronto' then raise exception 'Finalize after October 1 at 2 pm.';end if;
 if exists(select 1 from challenge_entries where status in ('pending','disputed') or proposed_done is not null) or exists(select 1 from challenge_requests where status='pending') then raise exception 'Resolve all reviews, corrections and forgiveness requests first.';end if;
 insert into challenge_finalizations(user_id) values(auth.uid()) on conflict do nothing;
 if (select count(*) from challenge_finalizations)=2 then update challenge_config set finalized=true where id=1;end if;end $$;
