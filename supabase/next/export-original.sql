-- Step 1 of bringing The Original into PROD CHALLENGE. Run this in the OLD app's project
-- (the one thechallenge.win uses). It only reads: one select, no changes.
--
-- It returns one row with one value, `original`: the whole Sep 15 – Oct 14 challenge as JSON.
-- Copy that value and paste it into supabase/next/load-original.sql where it says PASTE HERE.
select jsonb_build_object(
  'config', (select to_jsonb(c) from public.challenge_config c where id = 1),
  'profiles', (select coalesce(jsonb_agg(to_jsonb(p)), '[]') from public.challenge_profiles p),
  'rules', (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from public.challenge_rules r),
  'entries', (select coalesce(jsonb_agg(to_jsonb(e)), '[]') from public.challenge_entries e),
  'points', (select coalesce(jsonb_agg(to_jsonb(p)), '[]') from public.challenge_points p),
  'requests', (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from public.challenge_requests r),
  'disputes', (select coalesce(jsonb_agg(to_jsonb(d)), '[]') from public.challenge_disputes d),
  'notes', (select coalesce(jsonb_agg(to_jsonb(n)), '[]') from public.challenge_journal_notes n)
)::text as original;
