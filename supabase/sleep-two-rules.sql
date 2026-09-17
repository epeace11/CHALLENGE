-- Sleep becomes two rules instead of three. Run once in the Supabase SQL editor; rerunnable.
--   bed      -> "In bed by 11 pm, then read until you sleep"   (kept, retitled; past logs stay)
--   screens  -> "No screens in the bedroom"                    (kept, retitled; past logs stay)
--   phone    -> retired. Its meaning is covered by the new screens rule.
-- Every logged phone entry so far was done (points voided), so removing them changes no totals.
-- Runs under the same advisory lock as the hourly job so it cannot generate a phone miss in between.
begin;
select pg_advisory_xact_lock(8092026);

update public.challenge_rules set title='In bed by 11 pm, then read until you sleep' where id='bed';
update public.challenge_rules set title='No screens in the bedroom' where id='screens';

-- Remove phone data in dependency order. Audit rows have no foreign key and are kept as history.
delete from public.challenge_requests where point_id in (select id from public.challenge_points where rule_id='phone');
delete from public.challenge_disputes where entry_id in (select id from public.challenge_entries where rule_id='phone');
delete from public.challenge_points where rule_id='phone';
delete from public.challenge_entries where rule_id='phone';
delete from public.challenge_rules where id='phone';

select public.challenge_rescore();
commit;

-- Sanity check: expect two Sleep rules with the new titles and no phone rows anywhere.
select id,title from public.challenge_rules where id in ('bed','phone','screens') order by id;
select (select count(*) from public.challenge_entries where rule_id='phone') phone_entries,(select count(*) from public.challenge_points where rule_id='phone') phone_points;
