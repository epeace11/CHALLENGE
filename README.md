# September Challenge

Two-person habit logging for Erin and Kazzy. The approved light glass design works on desktop and mobile; mobile navigation is fixed at the bottom. Habit answers save individually to Supabase. Dollar totals appear on Money, using the recipient-first gift wording.

## Development

Run `npm install`, then `npm run dev`. Run `npm run build` for the Sites/Cloudflare deployment. This checkout uses the Sites Vinext starter (Next.js App Router-compatible React) rather than a Vercel deployment. Supabase hosts authentication, Postgres, and private screenshots.

`lib/supabase.ts` contains only the user-provided public project URL and publishable key. It has no service-role credential. Auth sessions are handled by the Supabase client; user records are persisted in Postgres, not browser local storage.

## Database

`supabase/setup.sql` initializes an empty project once. It only enrolls the two existing Auth accounts, matching their names/email; it refuses other account counts. Never rerun the setup against a populated database. `supabase/schedule.sql` installs the hourly pg_cron job. Both were applied to the connected project during setup.

All challenge tables enable Row Level Security. Authenticated members may read challenge data; clients cannot directly insert/update/delete rows. Security-definer functions validate membership, ownership, partner review, proof, deadline, and finalization under a transaction lock. Storage permits only member reads and uploads to the signed-in member’s folder. Proof is compressed before upload, and available EXIF date metadata is captured first.

At noon Toronto time, unlogged daily habits become provisional misses. Late corrections remain proposals until partner approval. Gym shortfalls are assessed after the last day’s noon logging deadline, not at midnight. The final Sunday–Wednesday partial week has a target of one visit, following the agreed reduced final target. Each new active point increases the total gift cost by its position; forgiven and voided points are excluded, with history retained. Both members must finalize after October 1 noon and all outstanding reviews are resolved.

The scheduled function runs every hour; checks use Toronto local dates, so daylight-saving changes are handled by Postgres timezone conversion. It also runs on authenticated data refresh. No individual logging action waits until the form is finished to save.

## Validation

- `npx tsc --noEmit`
- `node tests/database.mjs` runs PostgreSQL schema and authorization/scoring tests in an isolated PGlite database with dummy Auth accounts.
- `npm run build`

No live habit records are inserted by the local tests. The app opens with actual empty challenge data, not mockup sample points.

## Future challenges

As agreed, new challenges are set up through Codex rather than an in-app admin editor. September’s SQL rules/targets are configurable, but the current UI and singleton challenge schema are scoped to this September. A new month needs a versioned challenge migration and updated display rules; do not overwrite September history. Multi-month selection is not included in this release.

## Agent navigation

A feature-detected WebMCP `open_challenge_page` tool provides navigation only. It cannot bypass Supabase auth or save habits. Unsupported browsers ignore it.
