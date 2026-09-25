-- Push reminders (September 25, 2026). Run once in the Supabase SQL editor; rerunnable.
--
-- Each member can register their phone for web push from the Overview. The remind Edge Function
-- (supabase/functions/remind), called hourly by push-reminders-schedule.sql, sends one notification
-- in the evening to anyone who still has unlogged daily habits for the day that locks at 11:59 pm.
-- See the Reminders section of README.md for the setup steps.
create table if not exists public.challenge_push_subscriptions(endpoint text primary key,user_id uuid not null references public.challenge_profiles,p256dh text not null,auth text not null,created_at timestamptz not null default now());
alter table public.challenge_push_subscriptions enable row level security;
drop policy if exists push_own_read on public.challenge_push_subscriptions;
create policy push_own_read on public.challenge_push_subscriptions for select to authenticated using(user_id=auth.uid());
grant select on public.challenge_push_subscriptions to authenticated;
revoke insert,update,delete on public.challenge_push_subscriptions from anon,authenticated;
-- A device (endpoint) belongs to whoever registered it last, so a shared phone follows the signed-in member.
create or replace function public.challenge_push_subscribe(p_endpoint text,p_p256dh text,p_auth text) returns void language plpgsql security definer set search_path=public as $$ begin
 if not challenge_member() then raise exception 'This challenge is only for Erin and Kazzy.'; end if;
 if p_endpoint is null or p_endpoint not like 'https://%' or length(p_endpoint)>2000 or coalesce(p_p256dh,'')='' or coalesce(p_auth,'')='' or length(p_p256dh)>500 or length(p_auth)>500 then raise exception 'Invalid push subscription.'; end if;
 insert into challenge_push_subscriptions(endpoint,user_id,p256dh,auth) values(p_endpoint,auth.uid(),p_p256dh,p_auth) on conflict(endpoint) do update set user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth;
end $$;
create or replace function public.challenge_push_unsubscribe(p_endpoint text) returns void language plpgsql security definer set search_path=public as $$ begin
 if not challenge_member() then raise exception 'This challenge is only for Erin and Kazzy.'; end if;
 delete from challenge_push_subscriptions where endpoint=p_endpoint and user_id=auth.uid();
end $$;
revoke all on function public.challenge_push_subscribe(text,text,text),public.challenge_push_unsubscribe(text) from public,anon;
grant execute on function public.challenge_push_subscribe(text,text,text),public.challenge_push_unsubscribe(text) to authenticated;
-- Who still has unlogged daily habits for the day that locks tonight (yesterday, Toronto time), with how many and which.
-- Only the service role (the Edge Function) may call it.
create or replace function public.challenge_reminders() returns table(user_id uuid,name text,day date,missing integer,titles text[]) language sql stable security definer set search_path=public as $$
 with c as (select start_date,end_date,finalized,(now() at time zone 'America/Toronto')::date-1 as day from challenge_config where id=1)
 select p.id,p.name,c.day,count(*)::integer,array_agg(r.title order by r.id)
 from c cross join challenge_profiles p join challenge_rules r on (r.person is null or r.person=p.name)
 where not c.finalized and c.day between c.start_date and c.end_date and not r.weekly
  and (not r.weeknights or extract(dow from c.day)<=4) and (not r.weekends or extract(dow from c.day)>4)
  and not exists(select 1 from challenge_entries e where e.user_id=p.id and e.rule_id=r.id and e.day=c.day)
 group by p.id,p.name,c.day $$;
revoke all on function public.challenge_reminders() from public,anon,authenticated;
grant execute on function public.challenge_reminders() to service_role;
insert into public.challenge_scripts(name,ran_at) values('push-reminders.sql',now()) on conflict(name) do update set ran_at=now(),runs=challenge_scripts.runs+1;
