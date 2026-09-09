-- September Challenge: run once in the Supabase SQL editor.
-- Only the two existing Auth accounts are enrolled. No public signup enrollment.
begin;
create table public.challenge_profiles(id uuid primary key references auth.users(id),name text unique not null check(name in ('Erin','Kazzy')));
do $$ declare u record; n integer:=0; begin
 if (select count(*) from auth.users)<>2 then raise exception 'Expected exactly two Auth accounts. Map accounts manually before running.'; end if;
 for u in select id,email,raw_user_meta_data from auth.users loop
 insert into public.challenge_profiles values(u.id,case when lower(coalesce(u.raw_user_meta_data->>'name','')||u.email) like '%erin%' then 'Erin' when lower(coalesce(u.raw_user_meta_data->>'name','')||u.email) like '%kaz%' then 'Kazzy' else null end);
 end loop;
end $$;
create table public.challenge_config(id integer primary key default 1 check(id=1),name text not null default 'September Challenge',start_date date not null default '2026-09-08',end_date date not null default '2026-09-30',finalized boolean not null default false,allow_same_day boolean not null default false);
insert into public.challenge_config(id) values(1);
create table public.challenge_rules(id text primary key,title text not null,person text,weeknights boolean not null default false,proof_required boolean not null default false,weekly boolean not null default false);
insert into public.challenge_rules values ('bed','In bed by 11 pm',null,true,false,false),('phone','Phone outside the bedroom',null,true,false,false),('screens','No screens before sleep',null,true,false,false),('weed','No smoking weed',null,true,false,false),('prayer','Pray daily',null,false,false,false),('food','No eating out',null,false,false,false),('time','Screen time: 1 hour or less',null,false,true,false),('entertainment','No entertainment before 6 pm',null,false,false,false),('steps','10,000 steps','Erin',false,true,false),('calories','2,300 calories or less + macros tracked','Kazzy',false,true,false),('gym','Go to gym',null,false,false,true);
create table public.challenge_weeks(start_date date primary key,end_date date not null,target integer not null);
insert into public.challenge_weeks values('2026-09-08','2026-09-12',3),('2026-09-13','2026-09-19',4),('2026-09-20','2026-09-26',4),('2026-09-27','2026-09-30',1);
create table public.challenge_entries(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.challenge_profiles,rule_id text not null references public.challenge_rules,day date not null,done boolean not null,status text not null check(status in ('pending','confirmed','missed','disputed','conceded','excused','unlogged')),note text not null default '',proof text,proposed_done boolean,proposed_note text,proposed_proof text,updated_at timestamptz not null default now(),unique(user_id,rule_id,day));
create table public.challenge_points(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.challenge_profiles,rule_id text not null references public.challenge_rules,day date not null,reason text not null,forgiven boolean not null default false,voided boolean not null default false,entry_id uuid references public.challenge_entries,slot integer not null default 0,created_at timestamptz not null default now(),unique(user_id,rule_id,day,slot));
create table public.challenge_requests(id uuid primary key default gen_random_uuid(),point_id uuid unique not null references public.challenge_points,requester_id uuid not null references public.challenge_profiles,reason text not null,status text not null default 'pending',decided_by uuid references public.challenge_profiles,decided_at timestamptz);
create table public.challenge_disputes(id uuid primary key default gen_random_uuid(),entry_id uuid not null references public.challenge_entries,raised_by uuid not null references public.challenge_profiles,comment text not null,status text not null default 'open',created_at timestamptz not null default now(),resolved_at timestamptz);
create table public.challenge_finalizations(user_id uuid primary key references public.challenge_profiles,created_at timestamptz not null default now());
create table public.challenge_audit(id bigint generated always as identity primary key,entry_id uuid,actor uuid,action text not null,details jsonb,created_at timestamptz not null default now());
create function public.challenge_member() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from challenge_profiles where id=auth.uid()) $$;
create function public.challenge_assert() returns void language plpgsql security definer set search_path=public as $$ begin if not challenge_member() then raise exception 'This challenge is only for Erin and Kazzy.'; end if; perform pg_advisory_xact_lock(8092026); if (select finalized from challenge_config where id=1) then raise exception 'This challenge is finalized.'; end if; end $$;
create function public.challenge_rescore() returns void language plpgsql security definer set search_path=public as $$ declare w record;p record;n integer;i integer;begin
 for w in select * from challenge_weeks where ((end_date+1)+time '12:00') at time zone 'America/Toronto'<=now() loop
 for p in select * from challenge_profiles loop
 select greatest(0,w.target-count(*)::integer) into n from challenge_entries where user_id=p.id and rule_id='gym' and day between w.start_date and w.end_date and done and status not in ('conceded','missed','unlogged');
 for i in 1..w.target loop
 insert into challenge_points(user_id,rule_id,day,reason,slot,voided) values(p.id,'gym',w.end_date,'weekly_shortfall',i,i>n) on conflict(user_id,rule_id,day,slot) do update set voided=excluded.voided;
 end loop;end loop;end loop;end $$;
create function public.challenge_tick() returns void language plpgsql security definer set search_path=public as $$ begin
 perform pg_advisory_xact_lock(8092026);
 if (select finalized from challenge_config where id=1) then return; end if;
 insert into challenge_entries(user_id,rule_id,day,done,status)
 select p.id,r.id,d::date,false,'unlogged' from challenge_config c cross join challenge_profiles p cross join challenge_rules r cross join lateral generate_series(c.start_date::timestamp,least(c.end_date,((now() at time zone 'America/Toronto')-interval '12 hours')::date-1)::timestamp,interval '1 day') d
 where not r.weekly and (r.person is null or r.person=p.name) and (not r.weeknights or extract(dow from d)<=4) on conflict do nothing;
 insert into challenge_points(user_id,rule_id,day,reason,entry_id) select user_id,rule_id,day,'unlogged',id from challenge_entries where status='unlogged' and rule_id<>'gym' on conflict do nothing;
 update challenge_entries set status='confirmed' where status='pending' and proposed_done is null and updated_at<=now()-interval '48 hours';
 perform challenge_rescore();end $$;
create function public.challenge_sync() returns void language plpgsql security definer set search_path=public as $$ begin if not challenge_member() then raise exception 'Unauthorized'; end if; perform challenge_tick(); end $$;
create function public.challenge_log(p_rule text,p_day date,p_done boolean,p_note text default '',p_proof text default null) returns void language plpgsql security definer set search_path=public as $$ declare r challenge_rules;e challenge_entries;late boolean; begin
 perform challenge_assert(); perform challenge_tick(); select * into r from challenge_rules where id=p_rule;
 if r.id is null or p_day not between (select start_date from challenge_config) and (select least(end_date,(now() at time zone 'America/Toronto')::date-case when allow_same_day then 0 else 1 end) from challenge_config) or (r.person is not null and r.person<>(select name from challenge_profiles where id=auth.uid())) or (r.weeknights and extract(dow from p_day)>4) then raise exception 'This habit is not available for that date.'; end if;
 if p_done and r.proof_required and p_proof is null then raise exception 'Attach a screenshot first.'; end if;
 if p_proof is not null and not exists(select 1 from storage.objects where bucket_id='challenge-proof' and name=p_proof and (storage.foldername(name))[1]=auth.uid()::text) then raise exception 'Invalid proof attachment.'; end if;
 select * into e from challenge_entries where user_id=auth.uid() and rule_id=p_rule and day=p_day;
 if e.status='disputed' then raise exception 'Resolve the dispute before editing.'; end if;
 late:=now()>((p_day+1)+time '12:00') at time zone 'America/Toronto';
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
create function public.challenge_review(p_entry uuid,p_action text,p_comment text default '') returns void language plpgsql security definer set search_path=public as $$ declare e challenge_entries;d challenge_disputes;begin
 perform challenge_assert();select * into e from challenge_entries where id=p_entry for update;if e.id is null then raise exception 'Entry not found';end if;
 if p_action in ('approve','dispute','reject_correction') then
 if e.user_id=auth.uid() then raise exception 'Only your partner can review this.';end if;
 if p_action='approve' then
 if e.status<>'pending' and e.proposed_done is null then raise exception 'This entry is not awaiting approval.';end if;
 update challenge_entries set done=coalesce(proposed_done,done),note=coalesce(proposed_note,note),proof=case when proposed_done is not null then proposed_proof else proof end,status=case when coalesce(proposed_done,done) then 'confirmed' else 'missed' end,proposed_done=null,proposed_note=null,proposed_proof=null where id=e.id returning * into e;
 if e.rule_id<>'gym' then insert into challenge_points(user_id,rule_id,day,reason,entry_id,voided) values(e.user_id,e.rule_id,e.day,'missed',e.id,e.done) on conflict(user_id,rule_id,day,slot) do update set voided=excluded.voided;end if;
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
 if p_action='concede' and e.rule_id<>'gym' then insert into challenge_points(user_id,rule_id,day,reason,entry_id) values(e.user_id,e.rule_id,e.day,'dispute_conceded',e.id) on conflict(user_id,rule_id,day,slot) do update set voided=false,reason='dispute_conceded';end if;
 else raise exception 'Unknown review action';end if;
 insert into challenge_audit(entry_id,actor,action,details) values(e.id,auth.uid(),p_action,jsonb_build_object('comment',p_comment));delete from challenge_finalizations where true;perform challenge_rescore();end $$;
create function public.challenge_forgive(p_point uuid,p_reason text) returns void language plpgsql security definer set search_path=public as $$ begin
 perform challenge_assert();if length(trim(p_reason))=0 or not exists(select 1 from challenge_points where id=p_point and user_id=auth.uid() and not forgiven and not voided) then raise exception 'An active point and reason are required.';end if;
 insert into challenge_requests(point_id,requester_id,reason) values(p_point,auth.uid(),left(p_reason,2000));delete from challenge_finalizations where true;end $$;
create function public.challenge_decide(p_request uuid,p_approve boolean) returns void language plpgsql security definer set search_path=public as $$ declare r challenge_requests;p challenge_points;begin
 perform challenge_assert();select * into r from challenge_requests where id=p_request for update;
 if r.id is null or r.requester_id=auth.uid() or r.status<>'pending' then raise exception 'Only your partner can decide a pending request.';end if;
 update challenge_requests set status=case when p_approve then 'approved' else 'denied' end,decided_by=auth.uid(),decided_at=now() where id=r.id;
 if p_approve then update challenge_points set forgiven=true where id=r.point_id returning * into p;update challenge_entries set status='excused' where id=p.entry_id;end if;delete from challenge_finalizations where true;end $$;
create function public.challenge_finalize() returns void language plpgsql security definer set search_path=public as $$ begin
 perform challenge_assert();perform challenge_tick();
 if now()<((select end_date+1 from challenge_config)+time '12:00') at time zone 'America/Toronto' then raise exception 'Finalize after October 1 at noon.';end if;
 if exists(select 1 from challenge_entries where status in ('pending','disputed') or proposed_done is not null) or exists(select 1 from challenge_requests where status='pending') then raise exception 'Resolve all reviews, corrections and forgiveness requests first.';end if;
 insert into challenge_finalizations(user_id) values(auth.uid()) on conflict do nothing;
 if (select count(*) from challenge_finalizations)=2 then update challenge_config set finalized=true where id=1;end if;end $$;
-- Client reads are member-only; writes are exclusively validated functions.
do $$ declare t text;begin foreach t in array array['challenge_profiles','challenge_config','challenge_rules','challenge_weeks','challenge_entries','challenge_points','challenge_requests','challenge_disputes','challenge_finalizations','challenge_audit'] loop execute format('alter table public.%I enable row level security',t);execute format('create policy member_read on public.%I for select to authenticated using(public.challenge_member())',t);execute format('grant select on public.%I to authenticated',t);execute format('revoke insert,update,delete on public.%I from anon,authenticated',t);end loop;end $$;
revoke all on function public.challenge_assert(),public.challenge_tick(),public.challenge_rescore() from public,anon,authenticated;
grant execute on function public.challenge_member() to authenticated;
revoke all on function public.challenge_sync(),public.challenge_log(text,date,boolean,text,text),public.challenge_review(uuid,text,text),public.challenge_forgive(uuid,text),public.challenge_decide(uuid,boolean),public.challenge_finalize() from public,anon;
grant execute on function public.challenge_sync(),public.challenge_log(text,date,boolean,text,text),public.challenge_review(uuid,text,text),public.challenge_forgive(uuid,text),public.challenge_decide(uuid,boolean),public.challenge_finalize() to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('challenge-proof','challenge-proof',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy proof_read on storage.objects for select to authenticated using(bucket_id='challenge-proof' and public.challenge_member());
create policy proof_insert on storage.objects for insert to authenticated with check(bucket_id='challenge-proof' and public.challenge_member() and (storage.foldername(name))[1]=auth.uid()::text);

create table public.challenge_photos(path text primary key,user_id uuid not null references public.challenge_profiles,taken_at text,uploaded_at timestamptz not null default now());
alter table public.challenge_photos enable row level security;
create policy photo_member_read on public.challenge_photos for select to authenticated using(public.challenge_member());
grant select on public.challenge_photos to authenticated;
revoke insert,update,delete on public.challenge_photos from anon,authenticated;
create function public.challenge_add_photo(p_path text,p_taken_at text default null) returns void language plpgsql security definer set search_path=public as $$ begin
 perform challenge_assert();
 if not exists(select 1 from storage.objects where bucket_id='challenge-proof' and name=p_path and (storage.foldername(name))[1]=auth.uid()::text) then raise exception 'Invalid proof attachment';end if;
 insert into challenge_photos(path,user_id,taken_at) values(p_path,auth.uid(),left(p_taken_at,100)) on conflict do nothing;
end $$;
revoke all on function public.challenge_add_photo(text,text) from public,anon;
grant execute on function public.challenge_add_photo(text,text) to authenticated;

commit;
-- Optional but recommended: enable pg_cron in Database > Extensions, then run:
-- select cron.schedule('challenge-hourly','0 * * * *','select public.challenge_tick()');
-- Every authenticated refresh also runs the same idempotent deadline assessment.
