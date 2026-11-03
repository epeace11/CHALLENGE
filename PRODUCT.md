# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Mobile web first; most use is on a phone. App stores come later, undecided when.

## Users

Couples: exactly two people per challenge. Erin shares the app with people, and they register themselves. Erin and Kazzy, who built it, are its first couple.

Each person checks in on their phone whenever they remember. There is no fixed time of day, and a day stays open for a while, so catching up on the day before is normal.

## Product Purpose

The Challenge lets a couple take on a set of habits together for a fixed run of days (30 by default) and keep each other honest. Each day both people answer for the day before. The other person reviews each answer, and each miss becomes a point. Points add up to a gift the person who missed gives the other.

Success for a couple:

- They finish all the days together and settle the gifts.
- It's fun between them: the points and gifts feel like a game, not a chore or a fight.
- They come back and start another challenge.

## Positioning

A habit tracker for two, where your partner checks your answers and each miss becomes a point toward a gift you give them. The stakes are a gift between the two of you, never money paid to the app or to strangers.

## Operating Context

- **Set up:** the couple picks a theme or a saved challenge, or writes their own rules (Say your rules drafts them from their own words). They set what a point costs (the step) and an optional cap, then both sign the pact.
- **Each day:** each person answers every rule for the day before, with a screenshot where a rule needs one. Weekly rules count weeks (for example, gym 3 times a week, Monday to Sunday).
- **Review:** each person approves or disputes their partner's answers. A missed answer can carry a request to forgive the point; a dispute is settled between them.
- **Gifts:** the first point costs the step, and each one after costs one more step ($1, $2, $3…), up to the cap if they set one.
- **The end:** ending a challenge early takes both people. At the end, the verdict says who gives which gift, and the challenge can be saved by name or shared by link.
- **Extras:** a practice day before the start, a Monday recap, evening reminders by push.
- `/preview` shows every page on a sample couple (Maya and Jordan) with no database; `/app` is the working app.

## Capabilities and Constraints

- **Words:**
  - Always "points", given with both people's numbers.
  - Gifts are "the gift you get" and "the gift you give", never "buy".
  - What a point costs is "What a point costs".
- **Themes:** 75-Day Challenge, Sleep & Screens Reset, Dry Month, and Fitness & Food. Never use "75 Hard" or "Dry January", which are trademarks.
- **Not now:** groups larger than two, payments, gift wishlists, nudges, a baby-prep theme, a public challenge library.
- **Day count:** comes from `lib/dates.ts`. Never hardcode 30.
- **Development:** this branch builds against the PROD CHALLENGE database. Erin and Kazzy's live app and its database stay untouched until go-live.

## Brand Commitments

- **Name:** The Challenge.
- **Voice:** plain and direct. No slogans or taglines, no abstract copy, nothing said that isn't needed. Buttons say what they do. Each thing is said once per screen.
- **Rules every page follows** (Kazzy's and Erin's, in `CLAUDE.md`):
  - One obvious main action per screen, as a filled button.
  - Every number can be tapped and leads somewhere useful; numbers nobody acts on are cut.
  - No pop-ups confirming an action. The page shows what changed, and only a failed write shows a message.
  - Nothing scrolls just a little: a sheet or page either fits or is a long list.
- **Design decisions:** Erin picks between 2–3 versions of a page. Her picks are recorded in `components/next/DESIGN-LOG.md`.

## Evidence on Hand

- **Sample data:** the sample couple's world in `lib/next/demo.ts` and the theme catalog in `lib/next/catalog.ts`.
- **Real data:** Erin and Kazzy's Sep–Oct 2026 challenge, to be imported into the new app (`supabase/next/import-original.sql`).
- **What doesn't exist yet:** testimonials, reviews, user counts, press, and pricing. Don't invent them.

## Product Principles

1. **Fair between two people.** Every point can be checked, disputed or forgiven, and ending early takes both.
2. **A game, not a chore.** Points and gifts stay light and between the two of them; nothing shames a miss.
3. **Quick on a phone, any time.** A check-in takes seconds and is easy to catch up on later.
4. **Show, don't announce.** The page changes to show what happened, instead of confirming it in a message.
5. **Finish together.** The design keeps both people going to the last day, and makes starting the next challenge easy.

## Accessibility & Inclusion

- **Tap targets** are at least 44px, and nothing is reachable only by a gesture.
- **Text sizes:** body text is 17px and secondary text 15px. Nothing is under 14px, and inputs are at least 16px.
- **Motion:** animations run 150–300 ms and never block a tap. They stop under `prefers-reduced-motion`.
- **Themes:** light and dark both work.
