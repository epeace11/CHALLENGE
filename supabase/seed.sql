-- ============================================================================
-- September 2026 challenge seed
-- ============================================================================
-- Prerequisites: create both auth users in the Supabase dashboard
-- (Authentication → Users → Add user, with "auto confirm" on), then replace
-- the two emails below.
-- ============================================================================

insert into profiles (id, slug, display_name)
select id, 'erin', 'Erin' from auth.users where email = 'erin@example.com'
on conflict (id) do nothing;

insert into profiles (id, slug, display_name)
select id, 'kazzy', 'Kazzy' from auth.users where email = 'kazzy@example.com'
on conflict (id) do nothing;

-- The challenge itself
insert into challenges (id, name, start_date, end_date, timezone, log_deadline_time, dispute_window_hours, unlogged_policy)
values ('00000000-0000-0000-0000-000000000901', 'September Challenge', '2026-09-08', '2026-09-30',
        'America/Toronto', '12:00', 48, 'all_missed')
on conflict (id) do nothing;

-- Rules. active_days: 0 = Sunday … 6 = Saturday. "Weeknights" = Sun–Thu.
insert into rules (challenge_id, sort_order, title, description, cadence, applies_to, active_days, weekly_target, proof_required)
values
  ('00000000-0000-0000-0000-000000000901', 1, 'In bed by 11:00 pm',
   'Lights-out in bed by 11:00 pm. Applies Sunday through Thursday nights.',
   'daily', 'both', '{0,1,2,3,4}', null, false),
  ('00000000-0000-0000-0000-000000000901', 2, 'No phone in the bedroom after 11 pm',
   'The phone stays outside the bedroom after 11:00 pm. Sunday through Thursday nights.',
   'daily', 'both', '{0,1,2,3,4}', null, false),
  ('00000000-0000-0000-0000-000000000901', 3, 'No screens until asleep',
   'After getting into bed: read or do something screen-free until you fall asleep. Sunday through Thursday nights.',
   'daily', 'both', '{0,1,2,3,4}', null, false),
  ('00000000-0000-0000-0000-000000000901', 4, 'Prayer once a day',
   'At least one intentional prayer, any time of day.',
   'daily', 'both', '{0,1,2,3,4,5,6}', null, false),
  ('00000000-0000-0000-0000-000000000901', 5, 'No eating out',
   'No restaurants, takeout or delivery. Groceries and home-cooked food only.',
   'daily', 'both', '{0,1,2,3,4,5,6}', null, false),
  ('00000000-0000-0000-0000-000000000901', 6, 'Work out',
   'Did you work out today? Gym, run, or home workout all count. Target: 4 per week (Sunday to Saturday). Partial weeks still need all 4.',
   'weekly', 'both', '{0,1,2,3,4,5,6}', 4, false),
  ('00000000-0000-0000-0000-000000000901', 7, 'Useless screen time under 1 hour',
   'Social media + games combined under 60 minutes. YouTube does not count. Attach your Screen Time screenshot.',
   'daily', 'both', '{0,1,2,3,4,5,6}', null, true),
  ('00000000-0000-0000-0000-000000000901', 8, 'No entertainment before 6 pm',
   'Before 6:00 pm, only educational content. Entertainment (shows, movies, fun videos) waits until evening.',
   'daily', 'both', '{0,1,2,3,4,5,6}', null, false),
  ('00000000-0000-0000-0000-000000000901', 9, '10,000 steps',
   'Hit 10,000 steps. Attach your step-count screenshot.',
   'daily', 'erin', '{0,1,2,3,4,5,6}', null, true),
  ('00000000-0000-0000-0000-000000000901', 10, 'Under 2,300 calories and macros tracked',
   'Both required: stay under 2,300 calories AND log macros. Missing either one is a miss. Attach the ChatGPT macro screenshot.',
   'daily', 'kazzy', '{0,1,2,3,4,5,6}', null, true);
