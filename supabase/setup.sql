-- 30 Day Challenge: run once in the Supabase SQL editor.
-- Only the two existing Auth accounts are enrolled. No public signup enrollment.
begin;
create table public.challenge_profiles(id uuid primary key references auth.users(id),name text unique not null check(name in ('Erin','Kazzy')));
do $$ declare u record; n integer:=0; begin
 if (select count(*) from auth.users)<>2 then raise exception 'Expected exactly two Auth accounts. Map accounts manually before running.'; end if;
 for u in select id,email,raw_user_meta_data from auth.users loop
 insert into public.challenge_profiles values(u.id,case when lower(coalesce(u.raw_user_meta_data->>'name','')||u.email) like '%erin%' then 'Erin' when lower(coalesce(u.raw_user_meta_data->>'name','')||u.email) like '%kaz%' then 'Kazzy' else null end);
 end loop;
end $$;
create table public.challenge_config(id integer primary key default 1 check(id=1),name text not null default '30 Day Challenge',start_date date not null default '2026-09-15',end_date date not null default '2026-10-14',finalized boolean not null default false,allow_same_day boolean not null default false);
insert into public.challenge_config(id) values(1);
create table public.challenge_rules(id text primary key,title text not null,person text,weeknights boolean not null default false,proof_required boolean not null default false,weekly boolean not null default false,weekends boolean not null default false);
insert into public.challenge_rules(id,title,person,weeknights,proof_required,weekly,weekends) values ('bed','In bed by 11 pm, then read until you sleep',null,true,false,false,false),('bed_1am','Weekends: in bed by 1 am, then read until you sleep','Kazzy',false,false,false,true),('screens','No screens in the bedroom',null,true,false,false,false),('weed','No smoking weed','Erin',true,false,false,false),('weed_daily','No smoking weed, all week','Kazzy',false,false,false,false),('prayer','Pray daily',null,false,false,false,false),('food','No eating out',null,false,false,false,false),('time','Screen time: 1 hour or less',null,false,true,false,false),('entertainment','No entertainment before 6 pm',null,false,false,false,false),('steps','10,000 steps','Erin',false,true,false,false),('calories','2,300 calories or less + macros tracked','Kazzy',false,true,false,false),('gym','Go to gym',null,false,false,true,false),('steps_weekly','10,000 steps, 3 days a week','Kazzy',false,true,true,false);
create table public.challenge_weeks(start_date date primary key,end_date date not null);
insert into public.challenge_weeks values('2026-09-15','2026-09-20'),('2026-09-21','2026-09-27'),('2026-09-28','2026-10-04'),('2026-10-05','2026-10-11'),('2026-10-12','2026-10-14');
-- Each weekly rule's target per week; the app reads this table too, so it is the one place targets live. A rule with no row (or 0) that week does not apply.
create table public.challenge_weekly_targets(rule_id text not null references public.challenge_rules,start_date date not null references public.challenge_weeks,target integer not null check(target>=0),primary key(rule_id,start_date));
insert into public.challenge_weekly_targets values('gym','2026-09-15',3),('gym','2026-09-21',4),('gym','2026-09-28',4),('gym','2026-10-05',4),('gym','2026-10-12',1),('steps_weekly','2026-09-21',1),('steps_weekly','2026-09-28',3),('steps_weekly','2026-10-05',3),('steps_weekly','2026-10-12',1);
create table public.challenge_entries(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.challenge_profiles,rule_id text not null references public.challenge_rules,day date not null,done boolean not null,status text not null check(status in ('pending','confirmed','missed','disputed','conceded','excused','unlogged')),note text not null default '',proof text,proposed_done boolean,proposed_note text,proposed_proof text,updated_at timestamptz not null default now(),unique(user_id,rule_id,day));
create table public.challenge_points(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.challenge_profiles,rule_id text not null references public.challenge_rules,day date not null,reason text not null,forgiven boolean not null default false,voided boolean not null default false,entry_id uuid references public.challenge_entries,slot integer not null default 0,created_at timestamptz not null default now(),unique(user_id,rule_id,day,slot));
create table public.challenge_requests(id uuid primary key default gen_random_uuid(),point_id uuid unique not null references public.challenge_points,requester_id uuid not null references public.challenge_profiles,reason text not null,status text not null default 'pending',decided_by uuid references public.challenge_profiles,decided_at timestamptz);
create table public.challenge_disputes(id uuid primary key default gen_random_uuid(),entry_id uuid not null references public.challenge_entries,raised_by uuid not null references public.challenge_profiles,comment text not null,status text not null default 'open',created_at timestamptz not null default now(),resolved_at timestamptz);
create table public.challenge_finalizations(user_id uuid primary key references public.challenge_profiles,created_at timestamptz not null default now());
create table public.challenge_audit(id bigint generated always as identity primary key,entry_id uuid,actor uuid,action text not null,details jsonb,created_at timestamptz not null default now());
create function public.challenge_member() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from challenge_profiles where id=auth.uid()) $$;
create function public.challenge_assert() returns void language plpgsql security definer set search_path=public as $$ begin if not challenge_member() then raise exception 'This challenge is only for Erin and Kazzy.'; end if; perform pg_advisory_xact_lock(8092026); if (select finalized from challenge_config where id=1) then raise exception 'This challenge is finalized.'; end if; end $$;
create function public.challenge_rescore() returns void language plpgsql security definer set search_path=public as $$ declare w record;p record;n integer;i integer;begin
 for w in select k.start_date,k.end_date,t.rule_id,t.target from challenge_weeks k join challenge_weekly_targets t using(start_date) join challenge_rules r on r.id=t.rule_id where r.weekly and ((k.end_date+1)+time '23:59') at time zone 'America/Toronto'<=now() loop
 for p in select pr.* from challenge_profiles pr join challenge_rules r on r.id=w.rule_id where r.person is null or r.person=pr.name loop
 select greatest(0,w.target-count(*)::integer) into n from challenge_entries where user_id=p.id and rule_id=w.rule_id and day between w.start_date and w.end_date and done and status not in ('conceded','missed','unlogged');
 for i in 1..w.target loop
 insert into challenge_points(user_id,rule_id,day,reason,slot,voided) values(p.id,w.rule_id,w.end_date,'weekly_shortfall',i,i>n) on conflict(user_id,rule_id,day,slot) do update set voided=excluded.voided;
 end loop;end loop;end loop;end $$;
create function public.challenge_tick() returns void language plpgsql security definer set search_path=public as $$ begin
 perform pg_advisory_xact_lock(8092026);
 if (select finalized from challenge_config where id=1) then return; end if;
 insert into challenge_entries(user_id,rule_id,day,done,status)
 select p.id,r.id,d::date,false,'unlogged' from challenge_config c cross join challenge_profiles p cross join challenge_rules r cross join lateral generate_series(c.start_date::timestamp,least(c.end_date,((now() at time zone 'America/Toronto')-interval '23 hours 59 minutes')::date-1)::timestamp,interval '1 day') d
 where not r.weekly and (r.person is null or r.person=p.name) and (not r.weeknights or extract(dow from d)<=4) and (not r.weekends or extract(dow from d)>4) on conflict do nothing;
 insert into challenge_points(user_id,rule_id,day,reason,entry_id) select user_id,rule_id,day,'unlogged',id from challenge_entries where status='unlogged' and rule_id not in (select id from challenge_rules where weekly) on conflict do nothing;
 update challenge_entries set status='confirmed' where status='pending' and proposed_done is null and updated_at<=now()-interval '48 hours';
 perform challenge_rescore();end $$;
create function public.challenge_sync() returns void language plpgsql security definer set search_path=public as $$ begin if not challenge_member() then raise exception 'Unauthorized'; end if; perform challenge_tick(); end $$;
-- An answer is locked in once its 11:59 pm deadline has passed and nothing is waiting on it: approved, auto-confirmed, forgiven, conceded, or a settled No. Unlogged misses stay open to late corrections.
create function public.challenge_locked(e public.challenge_entries) returns boolean language sql stable set search_path=public as $$ select e.id is not null and now()>((e.day+1)+time '23:59') at time zone 'America/Toronto' and e.status in ('confirmed','missed','excused','conceded') and e.proposed_done is null $$;
create function public.challenge_log(p_rule text,p_day date,p_done boolean,p_note text default '',p_proof text default null) returns void language plpgsql security definer set search_path=public as $$ declare r challenge_rules;e challenge_entries;late boolean; begin
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
create function public.challenge_review(p_entry uuid,p_action text,p_comment text default '') returns void language plpgsql security definer set search_path=public as $$ declare e challenge_entries;d challenge_disputes;begin
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
create function public.challenge_forgive(p_point uuid,p_reason text) returns void language plpgsql security definer set search_path=public as $$ begin
 perform challenge_assert();if length(trim(p_reason))=0 or not exists(select 1 from challenge_points where id=p_point and user_id=auth.uid() and not forgiven and not voided) then raise exception 'An active point and reason are required.';end if;
 if exists(select 1 from challenge_points p join challenge_entries e on e.id=p.entry_id where p.id=p_point and challenge_locked(e)) then raise exception 'This answer is locked in.';end if;
 insert into challenge_requests(point_id,requester_id,reason) values(p_point,auth.uid(),left(p_reason,2000))
 on conflict(point_id) do update set reason=excluded.reason,status='pending',decided_by=null,decided_at=null where challenge_requests.status<>'approved';
 delete from challenge_finalizations where true;end $$;
-- Partner-initiated forgiveness (or undoing it) without a request.
create function public.challenge_partner_forgive(p_point uuid,p_forgive boolean) returns void language plpgsql security definer set search_path=public as $$ declare p challenge_points;begin
 perform challenge_assert();select * into p from challenge_points where id=p_point for update;
 if p.id is null or p.user_id=auth.uid() or p.voided then raise exception 'Only your partner can forgive an active point.';end if;
 update challenge_points set forgiven=p_forgive where id=p.id;
 if p.entry_id is not null then update challenge_entries set status=case when p_forgive then 'excused' when status='excused' then 'missed' else status end where id=p.entry_id;end if;
 update challenge_requests set status=case when p_forgive then 'approved' else 'denied' end,decided_by=auth.uid(),decided_at=now() where point_id=p.id and status in ('pending','approved','denied');
 insert into challenge_audit(entry_id,actor,action,details) values(p.entry_id,auth.uid(),'partner_forgive',jsonb_build_object('point',p.id,'forgiven',p_forgive));
 delete from challenge_finalizations where true;perform challenge_rescore();end $$;
create function public.challenge_decide(p_request uuid,p_approve boolean) returns void language plpgsql security definer set search_path=public as $$ declare r challenge_requests;p challenge_points;begin
 perform challenge_assert();select * into r from challenge_requests where id=p_request for update;
 if r.id is null or r.requester_id=auth.uid() or r.status<>'pending' then raise exception 'Only your partner can decide a pending request.';end if;
 update challenge_requests set status=case when p_approve then 'approved' else 'denied' end,decided_by=auth.uid(),decided_at=now() where id=r.id;
 if p_approve then update challenge_points set forgiven=true where id=r.point_id returning * into p;update challenge_entries set status='excused' where id=p.entry_id;end if;delete from challenge_finalizations where true;end $$;
create function public.challenge_finalize() returns void language plpgsql security definer set search_path=public as $$ begin
 perform challenge_assert();perform challenge_tick();
 if now()<((select end_date+1 from challenge_config)+time '23:59') at time zone 'America/Toronto' then raise exception 'Finalize after % at 11:59 pm.',to_char((select end_date+1 from challenge_config),'FMMonth FMDD');end if;
 if exists(select 1 from challenge_entries where status in ('pending','disputed') or proposed_done is not null) or exists(select 1 from challenge_requests where status='pending') then raise exception 'Resolve all reviews, corrections and forgiveness requests first.';end if;
 insert into challenge_finalizations(user_id) values(auth.uid()) on conflict do nothing;
 if (select count(*) from challenge_finalizations)=2 then update challenge_config set finalized=true where id=1;end if;end $$;
-- Client reads are member-only; writes are exclusively validated functions.
do $$ declare t text;begin foreach t in array array['challenge_profiles','challenge_config','challenge_rules','challenge_weeks','challenge_weekly_targets','challenge_entries','challenge_points','challenge_requests','challenge_disputes','challenge_finalizations','challenge_audit'] loop execute format('alter table public.%I enable row level security',t);execute format('create policy member_read on public.%I for select to authenticated using(public.challenge_member())',t);execute format('grant select on public.%I to authenticated',t);execute format('revoke insert,update,delete on public.%I from anon,authenticated',t);end loop;end $$;
revoke all on function public.challenge_locked(public.challenge_entries),public.challenge_assert(),public.challenge_tick(),public.challenge_rescore() from public,anon,authenticated;
grant execute on function public.challenge_member() to authenticated;
revoke all on function public.challenge_sync(),public.challenge_log(text,date,boolean,text,text),public.challenge_review(uuid,text,text),public.challenge_forgive(uuid,text),public.challenge_decide(uuid,boolean),public.challenge_finalize() from public,anon;
grant execute on function public.challenge_sync(),public.challenge_log(text,date,boolean,text,text),public.challenge_review(uuid,text,text),public.challenge_forgive(uuid,text),public.challenge_partner_forgive(uuid,boolean),public.challenge_decide(uuid,boolean),public.challenge_finalize() to authenticated;
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

-- Daily journal notes, any number per person per day; never affect scoring.
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
create or replace function public.challenge_journal_edit(p_id uuid,p_text text) returns void language plpgsql security definer set search_path=public as $$ begin
 if not challenge_member() then raise exception 'This challenge is only for Erin and Kazzy.'; end if;
 if length(trim(coalesce(p_text,'')))=0 then raise exception 'Write something first.'; end if;
 if length(p_text)>4000 then raise exception 'Keep each note under 4,000 characters.'; end if;
 update challenge_journal_notes set text=trim(p_text) where id=p_id and user_id=auth.uid();
 if not found then raise exception 'You can only edit your own notes.'; end if;
end $$;
revoke all on function public.challenge_journal_edit(uuid,text) from public,anon;
grant execute on function public.challenge_journal_edit(uuid,text) to authenticated;
-- Live updates: publish row changes so the app can refresh the moment the other person logs, reviews or writes.
-- Row-level security still applies, so only members receive them.
do $$ declare t text; begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  foreach t in array array['challenge_entries','challenge_points','challenge_requests','challenge_disputes','challenge_finalizations','challenge_config','challenge_journal_notes'] loop
   if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
    execute format('alter publication supabase_realtime add table public.%I',t);
   end if;
  end loop;
 end if;
end $$;
-- Change history: see supabase/change-history.sql for what these record.
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
 foreach t in array array['challenge_entries','challenge_points','challenge_requests','challenge_disputes','challenge_weeks','challenge_weekly_targets','challenge_rules','challenge_config'] loop
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

commit;
-- Optional but recommended: enable pg_cron in Database > Extensions, then run:
-- select cron.schedule('challenge-hourly','0 * * * *','select public.challenge_tick()');
-- Every authenticated refresh also runs the same idempotent deadline assessment.
