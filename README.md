# 30 Day Challenge

Two-person habit logging for Erin and Kazzy. The approved light glass design works on desktop and mobile; mobile navigation is fixed at the bottom. Habit answers save individually to Supabase. Dollar totals appear on Money, using the recipient-first gift wording.

## Development

Run `npm install`, then `npm run dev`. Run `npm run build` for the Sites/Cloudflare deployment. This checkout uses the Sites Vinext starter (Next.js App Router-compatible React) rather than a Vercel deployment. Supabase hosts authentication, Postgres, and private screenshots.

`lib/supabase.ts` contains only the user-provided public project URL and publishable key. It has no service-role credential. Auth sessions are handled by the Supabase client; user records are persisted in Postgres, not browser local storage.

## Code layout

`app/page.tsx` only mounts `components/app/app.tsx`. Everything else is split by job:

- `lib/` — plain TypeScript, no React.
  - `rules.ts` the habits (titles, questions, days, who has them) and `activeRules`.
  - `dates.ts` `START`/`END`, Toronto dates, formatting and the 11:59 pm deadline.
  - `weeks.ts` Monday–Sunday weeks and their weekly targets.
  - `types.ts` the database row types and `Data` (every table the app reads, screenshot photo dates included).
  - `api.ts` every database call: `loadChallenge` and the typed `api.*` wrappers around the database functions. `supabase.ts` holds the client.
  - `proof.ts` screenshot paths, compression and upload.
  - `push.ts` web push for the evening reminders: support detection, subscribing this device, the public VAPID key.
  - `selectors.ts` small queries over the loaded data (points, review queue, calendar colours, weekly counts).
  - `progress.ts` scoring and statistics (bars, streaks, days won, costs, badges); tested by `tests/progress.mjs`.
- `hooks/` — auth, data loading with polling and Realtime, the clock, new-badge tracking, the reminder toggle (`use-push.ts`), the WebMCP tool.
- `components/app/` — `app.tsx` (sign-in gate, page switch, dialogs), `shell.tsx` (top bar, error bar, mobile nav) and `challenge-context.tsx`, which gives every page `useChallenge()`: the data, the signed-in member, `run()` for saving, navigation, the Log page’s day and step, and the open dialogs.
- `components/<page>/` — one folder per page: `overview/`, `log/`, `review/`, `progress/`, `rules/`; `auth/` for sign-in and password reset; `dialogs/` for the entry, habit and day views, the dispute and forgiveness dialogs and the confirm dialog (used before denying forgiveness or conceding a miss); `shared/` for pieces used on several pages (status pill, screenshots, journal, progress bar).
- `components/ui/` — the shadcn/Base UI primitives in use (dialog, tabs, radio group, checkbox, button). Add more with `npx shadcn add <name>`.
- `styles/` — the stylesheet, split by area and imported in order from `app/globals.css` (later files override earlier ones). Dark mode is `styles/dark.css`.
- `public/sw.js` — the service worker; it only shows push notifications and never intercepts requests.
- `supabase/functions/remind/` — the Deno Edge Function that sends the reminders (excluded from `tsc` and `oxlint`; see Reminders).

Where to change things:

| Change                            | Where                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------- |
| A habit’s wording, days or owner  | `lib/rules.ts` (and the matching row in `challenge_rules` via a SQL script)     |
| A weekly target                   | the `challenge_weekly_targets` row; the app reads it                            |
| Challenge dates or the deadline   | `lib/dates.ts` and `challenge_config`                                           |
| A new database call               | a wrapper in `lib/api.ts`, then `run(() => api.x(...))` from a component        |
| Scoring, streaks or badges        | `lib/progress.ts`, with a case in `tests/progress.mjs`                          |
| Dates, deadlines or the day count | `lib/dates.ts` (`START`, `END`, `TOTAL_DAYS`), with a case in `tests/dates.mjs` |
| A calendar colour or review rule  | `lib/selectors.ts`, with a case in `tests/selectors.mjs`                        |
| Reminder wording or hours         | `supabase/functions/remind/index.ts` (`REMIND_AT`), then redeploy it            |
| One page’s layout                 | its folder in `components/`                                                     |
| Colours or spacing                | `styles/`; dark mode in `styles/dark.css`                                       |

Run `npm run check` (types, lint, tests) before committing, and `npm run format` to format.

## Database

`supabase/setup.sql` initializes an empty project once. The challenge was restarted on September 15, 2026 as the 30 Day Challenge (Sep 15 – Oct 14) with `supabase/reset-30-day.sql`, which wiped the Sep 8–13 data and replaced the config and gym weeks; run it once, never again. `supabase/fix-deadline-6pm.sql` moves the logging deadline to 6 pm and is rerunnable; run it once on the live project. If the project was set up before the safeupdate fix, run `supabase/fix-safeupdate.sql` once in the SQL editor; it is rerunnable and only replaces function bodies. It only enrolls the two existing Auth accounts, matching their names/email; it refuses other account counts. Never rerun the setup against a populated database. `supabase/add-journal-notes.sql` adds the journal notes table and its add/remove functions, carrying over and retiring the earlier single-text `challenge_journals` table if present; it is rerunnable and must be run once on the live project (fresh installs get it from `setup.sql`). `supabase/journal-edit-realtime.sql` adds note editing and publishes the challenge tables to Supabase Realtime; rerunnable, run once on the live project. `supabase/sleep-two-rules.sql` (September 17, 2026) turns the three Sleep rules into two: bed is retitled to include reading until sleep, screens becomes “No screens in the bedroom”, and the phone rule is retired with its rows removed; rerunnable, run once on the live project. `supabase/kazzy-rules.sql` (September 18, 2026) adds a `weekends` flag to the rules table (Fri/Sat only, the mirror of `weeknights`) and two Kazzy-only rules: `bed_1am` (in bed by 1 am, Fri–Sat, alongside the shared 11 pm rule on Sun–Thu) and `weed_daily` (no weed any day), which replaces `weed` for him; Erin keeps `weed`, now marked as hers. Kazzy’s existing weed entries and points move to the new id. It also updates the hourly job and logging function for the flag, and undoes an earlier draft that had moved his weekday bed rows; rerunnable, run once on the live project. `supabase/multi-proof.sql` (September 18, 2026) lets one answer carry several screenshots: the proof column holds newline-separated storage paths, each checked against the member’s own uploads, at most six; rerunnable, run once on the live project. `supabase/fix-deadline-1159pm.sql` (September 24, 2026) moves the logging deadline to 11:59 pm the next day and re-opens any day the old 6 pm job had already auto-marked; rerunnable, run once on the live project. `supabase/gym-weeks-mon-sun.sql` (September 24, 2026) switches gym weeks from Sunday–Saturday to Monday–Sunday and moves the first week’s already-assessed shortfall points (and any forgiveness on them) to its new end date; rerunnable, run once on the live project. `supabase/change-history.sql` (September 24, 2026) adds `challenge_scripts`, a record of every hand-run SQL script (each script now ends by inserting its own name), and `challenge_history`, which records every change to entries, points, requests, disputes, weeks, rules and config with the actor (a member, or the hourly job/a script), the statement and the row before and after; points gain an `updated_at`. `supabase/steps-weekly.sql` (September 24, 2026; run after change-history) moves weekly targets into `challenge_weekly_targets`, which the app reads, so a target changes in one row; gym targets move there and `challenge_weeks.target` is dropped. It adds Kazzy’s `steps_weekly` rule (10,000 steps, screenshot required): one day for Sep 21–27, three for each full week, one for Oct 12–14; every weekly rule is scored like the gym. Both rerunnable, run once on the live project, in that order. New scripts should end with `insert into public.challenge_scripts(name,ran_at) values('<file>.sql',now()) on conflict(name) do update set ran_at=now(),runs=challenge_scripts.runs+1;`. The challenge’s first and last day live in `START`/`END` in `lib/dates.ts` (and `challenge_config`); the tests check `setup.sql` agrees with them. `supabase/lock-settled-answers.sql` (September 25, 2026) locks an answer once its deadline has passed and it is settled (approved, auto-confirmed, forgiven, conceded or a No): no edits and no forgiveness requests; unlogged misses, weekly shortfalls and direct partner forgiveness stay open; rerunnable, run once on the live project. `supabase/skip-noop-point-writes.sql` (September 25, 2026) makes the points touch trigger skip a row that has not changed: the weekly rescore that runs on every load used to rewrite every closed week's slot rows unchanged, Realtime published each write, and every open app reloaded and synced again in a loop; rerunnable, run once on the live project. `supabase/push-reminders.sql` (September 25, 2026) adds the push subscriptions table, the member functions that register or forget a device, and `challenge_reminders()`, which only the service role may call; rerunnable, run once on the live project. `supabase/push-reminders-schedule.sql` schedules the hourly call to the Edge Function; it needs the secret filled in first (see Reminders). `supabase/schedule.sql` installs the hourly pg_cron job. Both were applied to the connected project during setup.

All challenge tables enable Row Level Security. Authenticated members may read challenge data; clients cannot directly insert/update/delete rows. Security-definer functions validate membership, ownership, partner review, proof, deadline, and finalization under a transaction lock. Storage permits only member reads and uploads to the signed-in member’s folder. Proof is compressed before upload, and available EXIF date metadata is captured first. Several screenshots can be attached to one answer (for example each page of Screen Time), added or removed one at a time; an answer marked done keeps at least one.

At 11:59 pm Toronto time the next day, unlogged daily habits become provisional misses. Late corrections remain proposals until partner approval. Gym shortfalls are assessed after the last day’s 11:59 pm logging deadline. Gym weeks run Monday–Sunday, so each week is assessed once Sunday’s visit can no longer be logged (Monday 11:59 pm). The first Tuesday–Sunday partial week (Sep 15–20) has a target of three visits and the final Monday–Wednesday partial week (Oct 12–14) has a target of one, following the agreed reduced partial-week targets. Each new active point increases the total gift cost by its position; forgiven and voided points are excluded, with history retained. Both members must finalize after October 15 at 11:59 pm and all outstanding reviews are resolved.

The scheduled function runs every hour; checks use Toronto local dates, so daylight-saving changes are handled by Postgres timezone conversion. It also runs on authenticated data refresh. No individual logging action waits until the form is finished to save.

Each person can add any number of timestamped journal notes to a day, from the Overview (today), the Log page (the day being logged) or the calendar day view. Notes are readable by both members, editable and removable only by their author, never lock, and never affect scoring.

The app subscribes to Supabase Realtime for the published challenge tables and reloads within a moment of any change, on top of the 60-second poll and the reload on focus. Realtime respects row-level security, so only the two members receive events. Loads never overlap: a load requested mid-load runs once more afterwards, so stale data cannot land over fresh data. The poll, the focus reload and the first load run the deadline checks (`challenge_sync`) first; the reload after one of your own writes and the Realtime reload skip them, since the write already ran them. A failed background load shows in the error bar until the next successful one.

## Reminders

Each member can turn on push reminders for their phone from the Overview. A reminder goes out at 8 pm and again at 10 pm Toronto time, only to someone who still has unlogged daily habits for the day that locks at 11:59 pm that night, listing the habits. On iPhone the app must be on the home screen first (Share → Add to Home Screen); Android and desktop browsers work as they are. Subscriptions are per device and follow whoever is signed in on it.

The pieces: `public/sw.js` shows the notification; `lib/push.ts` and `hooks/use-push.ts` register the device through `challenge_push_subscribe`; `supabase/functions/remind` is a Supabase Edge Function that pg_cron calls every hour, asks `challenge_reminders()` who is due, and sends web push with VAPID. Setting it up once:

1. Run `supabase/push-reminders.sql` in the SQL editor.
2. The VAPID key pair and the `REMIND_SECRET` were generated into `supabase/functions/.env` (git-ignored). The public key is also in `lib/push.ts`; if you ever regenerate the pair, update both.
3. With the Supabase CLI signed in: `supabase functions deploy remind --no-verify-jwt --project-ref llctyiwwcytwmemmnrvw`, then `supabase secrets set --env-file supabase/functions/.env --project-ref llctyiwwcytwmemmnrvw`.
4. Check it: `curl -X POST "https://llctyiwwcytwmemmnrvw.supabase.co/functions/v1/remind?force=1" -H "x-remind-secret: <REMIND_SECRET>"` returns how many notifications were sent (`force=1` ignores the hour).
5. Put the secret into `supabase/push-reminders-schedule.sql` and run it. Without the schedule, nothing is ever sent.

A device whose subscription has expired (the push service answers 404 or 410) is forgotten automatically.

## Validation

- `npm run check` runs types (`tsc --noEmit`), lint (`oxlint`) and `npm test`.
- `npm test` runs `tests/database.mjs` (PostgreSQL schema and authorization/scoring tests in an isolated PGlite database with dummy Auth accounts, including that a no-op sync writes nothing), `tests/progress.mjs` (the statistics and the lock rule in `lib/progress.ts`), `tests/dates.mjs` (deadlines across daylight-saving changes) and `tests/selectors.mjs` (the review queue, calendar colours and costs).
- `npm run build`

No live habit records are inserted by the local tests. The app opens with actual empty challenge data, not mockup sample points.

## Future challenges

As agreed, new challenges are set up through Codex rather than an in-app admin editor. The SQL rules/targets are configurable, but the current UI and singleton challenge schema are scoped to this one 30-day run. A new challenge needs a versioned challenge migration and updated display rules; do not overwrite its history. Multi-month selection is not included in this release.

## Agent navigation

A feature-detected WebMCP `open_challenge_page` tool provides navigation only. It cannot bypass Supabase auth or save habits. Unsupported browsers ignore it.

## Direct Cloudflare Workers deployment

Connect the GitHub `main` branch (the separate Claude branch uses a different framework). In Cloudflare Workers Builds, use repository root `/`, leave the build command empty, and set the deploy command to `npm run deploy`. This command always runs the Vinext build before deploying `dist/server/wrangler.json`. Use Node 22.13 or later. The generated config names the Worker `sites-project`, so the deploy script passes `--name challenge` to publish to the `challenge` Worker (the one serving `thechallenge.win`). If the Worker is ever renamed, update that flag.

For local packaging verification without publishing: `npm run deploy -- --dry-run`.
