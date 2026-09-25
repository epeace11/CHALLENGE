-- Lock settled answers (September 25, 2026). Run once in the Supabase SQL editor; rerunnable.
-- Once an answer's 11:59 pm deadline has passed and it is settled (approved, auto-confirmed,
-- forgiven, conceded, or a No), it can no longer be edited and forgiveness can no longer be
-- requested for it. Unlogged misses still take late corrections and forgiveness requests,
-- weekly shortfalls can still be forgiven, and a partner can still forgive directly.

create or replace function public.challenge_locked(e public.challenge_entries) returns boolean language sql stable set search_path=public as $$ select e.id is not null and now()>((e.day+1)+time '23:59') at time zone 'America/Toronto' and e.status in ('confirmed','missed','excused','conceded') and e.proposed_done is null $$;
revoke all on function public.challenge_locked(public.challenge_entries) from public,anon,authenticated;

create or replace function public.challenge_log(p_rule text,p_day date,p_done boolean,p_note text default '',p_proof text default null) returns void language plpgsql security definer set search_path=public as $$ declare r challenge_rules;e challenge_entries;late boolean; begin
 perform challenge_assert(); perform challenge_tick(); select * into r from challenge_rules where id=p_rule;
 if r.id is null or p_day not between (select start_date from challenge_config) and (select least(end_date,(now() at time zone 'America/Toronto')::date-case when allow_same_day then 0 else 1 end) from challenge_config) or (r.person is not null and r.person<>(select name from challenge_profiles where id=auth.uid())) or (r.weekly and coalesce((select t.target from challenge_weekly_targets t join challenge_weeks k using(start_date) where t.rule_id=r.id and p_day between k.start_date and k.end_date),0)=0) or (r.weeknights and extract(dow from p_day)>4) or (r.weekends and extract(dow from p_day)<=4) then raise exception 'This habit is not available for that date.'; end if;
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

create or replace function public.challenge_forgive(p_point uuid,p_reason text) returns void language plpgsql security definer set search_path=public as $$ begin
 perform challenge_assert();if length(trim(p_reason))=0 or not exists(select 1 from challenge_points where id=p_point and user_id=auth.uid() and not forgiven and not voided) then raise exception 'An active point and reason are required.';end if;
 if exists(select 1 from challenge_points p join challenge_entries e on e.id=p.entry_id where p.id=p_point and challenge_locked(e)) then raise exception 'This answer is locked in.';end if;
 insert into challenge_requests(point_id,requester_id,reason) values(p_point,auth.uid(),left(p_reason,2000))
 on conflict(point_id) do update set reason=excluded.reason,status='pending',decided_by=null,decided_at=null where challenge_requests.status<>'approved';
 delete from challenge_finalizations where true;end $$;

insert into public.challenge_scripts(name,ran_at) values('lock-settled-answers.sql',now()) on conflict(name) do update set ran_at=now(),runs=challenge_scripts.runs+1;
