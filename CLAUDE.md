# Notes for coding agents

- Read the "Code layout" section of README.md first; it maps every folder and says where each kind of change goes.
- `lib/` is plain TypeScript imported by Node tests with `--experimental-strip-types`, so files under `lib/` import each other with relative `./x.ts` paths, never `@/`. (`lib/api.ts` and `lib/proof.ts` are browser-only and may use `@/`.)
- Pages and dialogs read shared state with `useChallenge()` from `components/app/challenge-context.tsx`; database writes go through `api.*` in `lib/api.ts`, wrapped in `run(...)` so busy/error/refresh are handled.
- Stylesheets in `styles/` are imported in order from `app/globals.css`; later files override earlier ones.
- Before finishing: `npm run check`, `npm run format`, and `npm run build`.
- Database changes are hand-run SQL scripts in `supabase/`; see the Database section of README.md. Each new script also goes into `supabase/setup.sql` (the fresh-install script the tests run) and ends with the `challenge_scripts` insert.
- `supabase/functions/` is a Deno Edge Function, excluded from `tsc` and `oxlint`; `public/sw.js` is plain JavaScript. Neither uses `@/`.
- `lib/dates.ts` owns the day count (`TOTAL_DAYS`); never hardcode 30.

## The prod-challenge branch

- This branch builds The Challenge for any couple (plan: https://claude.ai/artifact/4tDAsCb4TTFCf3tJeGyQcc). `main` runs Erin and Kazzy's live app at thechallenge.win: never merge into `main`, and never touch the live Supabase project `llctyiwwcytwmemmnrvw`. `lib/supabase.ts` points at the PROD CHALLENGE project (`pngcjrgealbqocfrlozw`).
- Never run `npm run deploy` on this branch: it publishes to the live `challenge` Worker. The test address is `npm run deploy:test` (the `challenge-test` Worker).
- Pull requests target `prod-challenge`; GitHub's default branch for this repo is an old Claude branch.
- The new UI lives in `components/next/` and `lib/next/` and is previewed at `/preview` on sample data only, with no database calls. Each page is `v1.tsx` in `components/next/pages/<page>/`; a page in a design round adds 2–3 versions, switched with the 1 2 3 buttons. Every page is the same width (720px) with the same side margins; `components/next/README.md` explains the kit, and `components/next/DESIGN-LOG.md` lists every version and records Kazzy's pick for each page. Whoever builds a page's versions edits only that page's folder; `/preview?kit` shows every kit component.
- The working app is `/app`: `components/live/` (the host) and `lib/live/` (`api.ts` database calls, `world.ts` rows to World). Pages in `components/next/pages/` change things only through `useBackend()` from `components/next/backend.tsx` (a command plus its pure action), keep their preview behaviour when `backend.host` is null, and never import `components/live/` or `lib/live/`; the no-network rule in `tests/next.mjs` covers `components/next/` and `lib/next/` only.
- The new product's database is `supabase/next/schema.sql` (fresh install, run by `tests/next-database.mjs`) plus `supabase/next/import-original.sql`. Change the schema there and in the test; since PROD CHALLENGE already has it, each change is also its own rerunnable script in `supabase/next/` (like `share-links.sql`), listed in README.md's Database section. The `challenge_scripts` rule above is for the old app's scripts. Every table has a challenge id (or a couple id), and every write is an `nx_*` function that calls `nx_enter` first.
- Design rules for every new page (Kazzy's): one obvious main action as a filled button, clear hierarchy, few things per screen; tap targets at least 44px; smooth animations of 150–300 ms that never block a tap and stop under `prefers-reduced-motion`; no slogans or abstract copy, and no unnecessary copy; text 17px for body, 15px secondary, never under 14px, inputs at least 16px; every number is tappable and leads somewhere useful, and numbers nobody acts on are cut.
