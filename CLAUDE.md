# Notes for coding agents

- Read the "Code layout" section of README.md first; it maps every folder and says where each kind of change goes.
- `lib/` is plain TypeScript imported by Node tests with `--experimental-strip-types`, so files under `lib/` import each other with relative `./x.ts` paths, never `@/`. (`lib/api.ts` and `lib/proof.ts` are browser-only and may use `@/`.)
- Pages and dialogs read shared state with `useChallenge()` from `components/app/challenge-context.tsx`; database writes go through `api.*` in `lib/api.ts`, wrapped in `run(...)` so busy/error/refresh are handled.
- Stylesheets in `styles/` are imported in order from `app/globals.css`; later files override earlier ones.
- Before finishing: `npm run check`, `npm run format`, and `npm run build`.
- Database changes are hand-run SQL scripts in `supabase/`; see the Database section of README.md.
