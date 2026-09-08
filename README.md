# Challenge Tracker

A two-person accountability app. Erin and Kazzy log daily habits, attach proof
screenshots, review and dispute each other's entries, and watch a running tally
of escalating dollar penalties. The rule set lives in the database, so a new
month is a new challenge row plus its rules — no code changes.

Stack: Next.js (App Router, TypeScript), Tailwind, Supabase (Postgres, Auth,
Storage), deployed on Cloudflare Workers via OpenNext.

## How it works

- **Scoring.** Every missed rule on a day is one point. A person's *n*-th point
  costs $*n*, so the total owed is n(n+1)/2. Totals are derived from point rows,
  never stored, and are not netted between the two of you.
- **Logging.** The form defaults to yesterday until noon, then today. A day
  locks at 12:00 noon (Toronto) the following day. At the lock, any rule with
  no entry is auto-marked as missed with reason *unlogged*.
- **Review.** Every "done" entry starts *pending*. Your partner can approve or
  dispute it (comment required). Pending entries auto-confirm after 48 hours.
  A dispute ends only when the logger concedes (point created) or the disputer
  withdraws (entry confirmed).
- **Forgiveness.** Any point you own can be contested once with a reason. If
  your partner approves, the point is marked forgiven (kept for history,
  excluded from totals) and the entry shows as *excused*. Forgiving an
  *unlogged* point re-opens that day for 24 hours so it can be logged properly.
- **Weekly rules.** Workouts are scored per Sunday–Saturday week:
  `max(0, target − done days)`. Partial first and last weeks still need the full
  target.
- **Proof.** Rules flagged `proof_required` cannot be marked done without at
  least one photo. Photos are compressed in the browser (1600px, JPEG 80%) and
  the EXIF `DateTimeOriginal` is shown beside each one when present.

All timestamps are stored in UTC. Day boundaries and deadlines are computed in
the challenge's timezone (`America/Toronto` by default) both in SQL and in the
app.

## Setup

### 1. Supabase

1. Create a project.
2. **Authentication → Users → Add user** twice (Erin and Kazzy), with
   *Auto confirm user* checked. There is no sign-up flow.
3. **SQL editor:** run `supabase/migrations/0001_schema.sql`. This creates the
   tables, the row-level-security policies, the transition functions, and the
   private `proofs` storage bucket.
4. Edit the two emails at the top of `supabase/seed.sql`, then run it. It links
   the auth users to the `erin` / `kazzy` profiles and creates the September
   challenge with its ten rules.

### 2. Environment

Copy `.env.example` to `.env.local` and fill in:

| variable | where |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page, *anon public* key |
| `SUPABASE_SERVICE_ROLE_KEY` | same page, *service_role* key (server only) |
| `CRON_SECRET` | any random string |

### 3. Run locally

```bash
npm install
npm run dev
```

`npm run dev` is plain Next.js and needs only `.env.local`. To run the real
Cloudflare bundle locally, see the preview note below.

### 4. Deploy to Cloudflare Workers

The app runs on Cloudflare Workers through the OpenNext adapter. `wrangler.jsonc`
declares the worker, its static assets, and an hourly cron trigger; `worker.ts`
wraps the generated worker and adds the `scheduled` handler that runs the jobs.

**Connect the repo (Workers & Pages → Create → Import a repository):**

| field | value |
|---|---|
| Build command | `npx opennextjs-cloudflare build` |
| Deploy command | `npx opennextjs-cloudflare deploy` |
| Production branch | the branch you want live |

**Variables.** In the Worker's Settings → Variables and Secrets, add all four
as secrets:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

The two `NEXT_PUBLIC_*` values are also baked into the browser bundle at build
time, so add those same two under Settings → Build → Build variables as well.

**From the command line instead:**

```bash
npx wrangler login
npx wrangler secret put NEXT_PUBLIC_SUPABASE_URL      # repeat for the other three
npm run deploy
```

Local preview of the production bundle: put the four values in `.dev.vars`
(git-ignored) and run `npm run preview`.

## Scheduled jobs

One idempotent job (`src/lib/jobs.ts`) does all scheduled work. Every step asks
"has this already been applied?" rather than "is it exactly noon?", so it is
safe to run at any frequency:

1. **Noon lock** — for every day whose deadline has passed and isn't locked
   yet, create missed entries and *unlogged* points, then record the lock.
2. **Auto-confirm** — pending entries older than the dispute window.
3. **Weekly assessment** — once the last day of a week has locked (Sunday at
   noon, so a Saturday workout can still be logged Sunday morning), score every
   weekly rule for that week. The final partial week is scored the same way
   after the challenge's last day locks.

It runs from three places:

- The Cloudflare cron trigger, hourly (`triggers.crons` in `wrangler.jsonc`).
  The `scheduled` handler in `worker.ts` calls `/api/cron/tick` with the
  `CRON_SECRET` bearer token.
- Every dashboard load, throttled to once per five minutes per worker
  instance. This is the safety net if the cron is delayed.
- Manually: `curl -H "Authorization: Bearer $CRON_SECRET" https://your-app/api/cron/tick`
  returns a JSON report of what it did.

## Security model

- Each user can only create or edit their **own** entries, and only while the
  day is open. Partners can approve, dispute, and decide forgiveness on the
  **other's** entries. This is enforced in Postgres: the tables allow reads to
  both users, while every write goes through a `SECURITY DEFINER` function
  (`save_entry`, `approve_entry`, `decide_forgiveness`, …) that checks
  `auth.uid()`, ownership, and lock state before touching a row. No direct
  insert/update policies exist on entries, photos, points, or disputes.
- The storage bucket is private. Users can upload only into their own folder;
  both users can read (signed URLs are generated server-side, one-hour TTL).
- The service-role key is used only by the scheduled job.

## Tests

```bash
npm test         # pure scoring/calendar logic (vitest)
npm run test:db  # SQL functions end-to-end against PGlite (Postgres in WASM)
npm run lint
npm run typecheck
```

`npm run test:db` stubs Supabase's `auth` and `storage` schemas, applies the
migration and seed, then walks through logging, proof, review, disputes,
forgiveness, the re-open window, day locks, and role permissions.

## Starting a new month

Open **Settings** (`/admin`), create a challenge with its dates, then add rules.
Each rule has a cadence (daily or weekly target), who it applies to, active
weekdays, and whether a photo is required. The dashboard shows the latest
challenge that has started.

## Deviations from the spec

- Weekly-rule logs live in `entries` (with `cadence` on the rule) rather than a
  separate `weekly_logs` table. Same shape, one code path for photos, review,
  and security.
- Forgiven points are kept with `forgiven = true` rather than deleted, so the
  ledger keeps the history. Totals exclude them.
- The weekly assessment runs after Sunday's noon lock instead of at Sunday
  00:00, otherwise a Saturday workout logged on Sunday morning would be
  missed.
- Weekly-rule entries also go through the approve/dispute review, since a
  workout is a claim like any other. A conceded workout simply doesn't count
  toward the week.

## Out of scope (v1)

Payments, push notifications, more than two users, health-app integrations.
