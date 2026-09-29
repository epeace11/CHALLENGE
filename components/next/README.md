# The new UI: a guide for page builders

The Challenge for any couple is designed here, on sample data only, before any of it touches a database. Every page has 2 or 3 versions; Erin and Kazzy compare them at `/preview` with the 1 2 3 buttons, and Kazzy picks one per page.

Read this whole file before you start. Then build your versions and nothing else.

## Ground rules

- **You edit only your page's folder**, `components/next/pages/<page>/`. Everything outside it (`lib/next/`, the kit in `ui/`, `frames/`, `styles/next.css`, the registry) is shared and finished; if it lacks something, build a local helper in your folder (see [Local helpers](#local-helpers)).
- **Sample data only.** No database, no network, no Supabase, no real sign-in: never import `@/lib/supabase`, `@/lib/api`, `@/lib/proof` or `@/lib/push`, and never call `fetch`. Links in the sample data (share links, invite links) are for showing and copying, never for opening.
- **No clock.** The sample world is frozen at Friday, Nov 20, 2026, 7:30 pm in Toronto. Use `world.now` and `world.today`; never `Date.now()`, `new Date()` or `Math.random()`.
- **Fictional people.** The couple is Maya (the viewer, `world.me`) and Jordan (`world.partner`). Other names in the data: Priya & Sam (who shared Dry October). Never Erin or Kazzy.
- **Kazzy's rules** (below) decide every screen. `npm run check` enforces the mechanical ones.

## Your folder

```
components/next/pages/overview/
  index.ts   the ordered list of versions (keep it: v1, v2, v3)
  v1.tsx     version 1
  v2.tsx     version 2
  v3.tsx     version 3 (only pages with 3 versions)
  …          anything else you need: local components, a CSS module
```

Each version file starts with **one line** saying what is different about it, then `'use client'`, then a default-exported component that renders its frame:

```tsx
// Numbers first: the three things to act on as big buttons, then this week.
'use client';
import { AppFrame } from '@/components/next/frames';
import { PageTitle, StatButton } from '@/components/next/ui';
import { useNav } from '@/components/next/nav';
import { useWorld } from '@/components/next/world';
import { openCheckins } from '@/lib/next/selectors';

export default function OverviewV1() {
  const world = useWorld();
  const { navigate } = useNav();
  const left = openCheckins(world, world.me.id).length;
  return (
    <AppFrame>
      <PageTitle title="Thursday" detail="3 check-ins left, until 11:59 pm" />
      <StatButton
        label="Left to log"
        value={left}
        tone="accent"
        onClick={() => navigate('log')}
      />
    </AppFrame>
  );
}
```

Keep `index.ts` exporting `versions` with exactly the planned number of versions. The registry imports it, so it never needs editing, and `tests/next.mjs` checks that every planned version file exists and starts with its one-line comment.

The versions of one page should differ in a real way (what comes first, how much is on the screen, how the main action works), not in colours. Each must pass every one of Kazzy's rules on its own.

## Seeing your work

```
npm run dev -- --port 3101          # any free port of your own
open http://localhost:3101/preview?page=overview&v=2
```

`/preview` lists every page; `?page=<id>&v=<n>` opens one version. The bar at the top switches versions (or press 1, 2, 3), light and dark, and the look (Classic, 75-Day, Sleep, Dry, Fitness). `/preview?kit` shows every kit component; `components/next/kit-gallery.tsx` is a working example of each.

Before you finish: `npm run format`, `npm run check` (types, lint, and tests including `tests/next.mjs`), and `npm run build`.

## The data

### The world

```ts
const world = useWorld(); // from '@/components/next/world'
```

`world` is a `World` (`lib/next/model.ts`): `now`, `today`, `me` (Maya), `partner` (Jordan), `couple`, `challenge` (Fall Reset: its rules, dates, deadline, step and look), `entries`, `points`, `requests` (forgiveness), `disputes`, `journal`, `saved` (Summer Sprint, Dry October), `past` (Summer Sprint with its verdict), `themes`, `library` (41 rules), `invite`, `pact`, `practice`, `sayRules`.

The world is frozen. Never change it in place (that throws); copy before sorting (`[...list].sort()`), and change it through actions (below).

### The key sample numbers

Friday, Nov 20, 2026, 7:30 pm, Toronto. Day 19 of 30 of **Fall Reset** (Mon Nov 2 – Tue Dec 1), classic look, $1 step, no cap, deadline 11:59 pm the next day.

- **Open day:** Thursday, Nov 19, until 11:59 pm tonight (4h 29m left).
- **Maya has 3 check-ins open** for Nov 19: Social media and games (number, screenshot required), Gym (weekly), Read 10 pages (number). She answered the other 4; **1 of hers waits for Jordan** (No alcohol).
- **Waiting for Maya (4):** 2 of Jordan's answers (10,000 steps: 11,240, with a screenshot; Social media: 48 min, with a screenshot), 1 forgiveness request (his Nov 18 eating out: "Team dinner for a coworker's last day…"), and 1 dispute Jordan raised on Maya's Nov 17 bedtime ("You were on the couch with your phone until 11:40.").
- **Points:** Maya 6, Jordan 9 (plus 1 forgiven). **Maya gets a $45 gift, Jordan a $21 gift; Maya is ahead by 3.** Maya's next miss adds $7, Jordan's $10.
- **Gym this week (Nov 16–22):** Maya 2 of 4 (4 days left to go twice, counting Thursday), Jordan 3 of 4.
- **Streaks worth protecting:** Maya, No phones in the bedroom, 18 days; Jordan, bedtime, 10.
- **Last week's recap (Nov 9–15):** Maya 2 points ($7), Jordan 3 ($15); Maya won the week; gym Maya 4 of 4, Jordan 3 of 4.
- **Stakes:** missing 1 in 10 check-ins, each gift would be about $150.
- **Badges:** Maya has 6 (next: Unbroken, 18 of 30 days).
- **Before day one:** Maya invited Jordan (`world.invite`, code FALL-7KQ2); Maya signed the pact, Jordan has not (`world.pact`).
- **Themes:** 75-Day Challenge ($0.25 step, 6 rules), Sleep & Screens Reset (5), Dry Month (no alcohol, no weed optional), Fitness & Food (4, with a personal calorie limit).
- **Say your rules:** `world.sayRules` holds the sentence, the 3 drafted rules and the question "Every night, or Sun–Thu like bedtime?".
- **Practice day:** `world.practice` holds 3 sample questions, a pretend review (approve one, dispute one) and a pretend miss.
- **The verdict:** `world.past[0]`: Summer Sprint (Jul 6–26), Maya 4 points and Jordan 7, so Maya got a $28 gift and Jordan a $10 gift.

### Selectors

Import from `@/lib/next/selectors` (it also re-exports every date helper and formatter). All are pure functions of the world.

| Question                           | Selector                                                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| What is left to log?               | `openCheckins(world, personId, day?)` → rules; `checkinProgress(world, personId)` → `{ due, answered, left }`                        |
| Which day is open, and until when? | `openDay(world)`, `timeLeft(world)` (ms) with `formatDuration`, `lockTime(challenge, day)`                                           |
| What waits for review?             | `reviewQueue(world, personId)` → `{ items, answers, corrections, forgiveness, disputes, count }`                                     |
| What waits on my partner?          | `waitingOnPartner(world, personId)`                                                                                                  |
| Points and gifts                   | `standings(world)` (both, viewer first), `activePoints`, `owes`, `gets`, `pointCost`, `nextMissCost`, `giftTotal(points, step, cap)` |
| Who is ahead?                      | `leader(world)` → `{ personId, margin }`                                                                                             |
| Gym this week                      | `weekProgress(world, personId, 'gym')` → `{ have, need, left, daysLeft, met, week }`                                                 |
| Streaks                            | `streaks(world, personId)`, `streakToProtect(world, personId)`                                                                       |
| Calendar                           | `calendar(world, personId)` → `{ day, number, color }[]`; `dayColor` is done / excused / missed / review / open / ahead              |
| An answer's pill                   | `entryPill(world, rule, entry, day)` → `{ status, label }` for `StatusPill`                                                          |
| Day number, days left              | `dayNumber(challenge, world.today)` (19), `daysLeft(challenge, world.today)` (12)                                                    |
| Stakes before starting             | `stakesPreview(plan, 0.1, [maya, jordan])` → `{ gift, perPerson }`; a theme needs a `start`                                          |
| Badges                             | `badges(world, personId)`, `nextBadge(world, personId)`                                                                              |
| Monday recap                       | `lastRecap(world)`, `weekRecap(world, week)`                                                                                         |
| Rules                              | `rulesFor`, `rulesOn(challenge, personId, day)`, `ruleById`, `libraryByGroup(world.library)`, `LOOKS`, `RULE_GROUPS`                 |
| Entries                            | `entryFor(world, personId, ruleId, day)`, `entriesOn`, `formatAnswer(rule, entry)`                                                   |
| Jordan's point of view             | `asViewer(world, 'jordan')` swaps `me` and `partner`                                                                                 |

Formatters (`lib/next/format.ts`): `formatDay` ("Thursday, Nov 19"), `formatDayShort` ("Thu, Nov 19"), `formatDate` ("Nov 19"), `formatRange` ("Nov 2 – Dec 1"), `formatMoney` ("$45", "$0.25"), `formatNumber`, `plural(6, 'point')`, `formatWeekdays` ("Sun–Thu"), `formatWhen(rule)` ("4 days a week"), `formatTarget` ("60 min or less"), `formatValue(rule, 48)` ("48 min"), `formatTime(world.now, tz)` ("7:30 pm"), `formatDeadline` ("11:59 pm the next day"), `formatDuration` ("4h 29m").

Sample screenshots for "add a screenshot" flows: `stepsShot(steps, day)` and `screenTimeShot(minutes, day)` from `@/lib/next/shots` return image URLs.

### Changing the world

Pages change the sample world with pure actions from `@/lib/next/actions` through `useDemo()`:

```tsx
const { update, undo } = useDemo(); // from '@/components/next/world'
const toast = useToast(); // from '@/components/next/ui'
update((w) => approve(w, entry.id));
toast({ text: 'Approved', action: { label: 'Undo', onClick: undo } });
```

Actions: `saveCheckin(w, { personId, ruleId, day, done | value, note, proofs, forgiveness })`, `approve` (answers and late answers), `rejectCorrection`, `dispute(w, entryId, raisedBy, comment)`, `concede`, `withdrawDispute`, `replyToDispute`, `askForgiveness`, `decideForgiveness(w, requestId, 'approved' | 'denied')`, `forgivePoint`, `addNote`, `editNote`, `removeNote`, `signPact`, `updateChallenge(w, patch)`, `setShareLink`, `sendInvite`. Changes last while the preview is open, across pages (log Maya's 3 check-ins on Check in, and Overview shows 0 left). "Reset sample data" on the page index starts over.

Local UI state (which sheet is open, a draft) stays in `useState` in your page.

## Navigation

```tsx
const { navigate } = useNav(); // from '@/components/next/nav'
navigate('review'); // opens Review on the version last chosen for it
```

Page ids: `landing signup shared start say setup home invite pact practice overview log rules review gifts progress recap verdict settings`. Every number, row and "See all" that leads somewhere calls `navigate`, or opens a `Sheet` for details. There is no router and no `<a href>` between pages.

## Frames

Each version renders its frame (see `components/next/pages/meta.ts` for which one; the placeholder already uses it).

- **`<AppFrame wide?>`** for pages inside the running challenge (Your challenges, Overview, Check in, Rules and help, Review, Gifts, Progress, Monday recap, Settings). It shows the challenge's name and "Day 19 of 30" (which opens Progress) and the navigation: Overview, Check in, Review (with the count of what waits), Progress, and More (Gifts, Rules and help, Monday recap, Settings, Your challenges). Bottom tab bar on phones, tabs in the top bar from 1024px. Content is 720px wide; `wide` allows 1080px for two columns on laptops.
- **`<PlainFrame back? aside? width? center?>`** for everything before or outside a running challenge (Landing, Sign up, Shared link, Start, Say your rules, Set up, Invite, Pact, Practice, Verdict). A quiet top bar with "The Challenge", or a Back button with `back={{ to: 'start' }}`; `aside` for something small on the right; `width` 'narrow' (520px) | 'normal' (720px) | 'wide' (1080px); `center` centres short content vertically.

Never render a second frame or another `NxRoot`. For the main action on a long screen, use `ActionBar`, which sticks above the tab bar.

## The kit

Import from `@/components/next/ui`. Every piece works in light and dark, in every look, and switches its motion off under reduced motion. `/preview?kit` shows them all.

| Component                             | Use                                                                                                                                                                                                                                                            |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                              | `variant`: `primary` (the one filled accent button per screen), `secondary` (outlined, default), `quiet` (text), `danger` (filled red). `size="lg"`, `full`, `loading`, `icon`, `iconEnd` (lucide icons). 48px tall, press animation.                          |
| `IconButton`                          | A 44px round icon button; `label` is required (screen readers).                                                                                                                                                                                                |
| `GlassCard`, `Card`                   | Frosted card (main surface) and quiet card. `pad`: none, sm, md (default), lg. `as`: div, section, article, li.                                                                                                                                                |
| `TapCard`                             | A whole glass card that is one button, with a chevron.                                                                                                                                                                                                         |
| `RowButton`                           | A big tappable row: `leading`, `title`, `detail`, `trailing`, chevron. For lists that open something.                                                                                                                                                          |
| `StatButton`                          | A number that is always a button: `label`, `value` (numbers count up; `format={formatMoney}`), `hint`, `tone` (accent, done, missed, wait), `size="lg"`, `onClick` (required). There is no non-interactive stat on purpose.                                    |
| `PageTitle`                           | The page's Georgia title with `kicker`, `detail` and an `action` (an IconButton).                                                                                                                                                                              |
| `Section`                             | A group with a serif `title`, an `action` (a quiet Button), and `index` to stagger its entrance.                                                                                                                                                               |
| `ProgressBar`                         | `value`/`max`, `tone`, `size`, `segments` (gym: 2 of 4 as four steps), `label` (required). Fills smoothly.                                                                                                                                                     |
| `StackedBar`                          | One bar in parts (done, excused, missed, wait, ahead) with a `label`.                                                                                                                                                                                          |
| `Avatar`, `PairAvatars`, `PersonChip` | People in their hue; a chip with `onClick` is a 44px button (`pressed` for toggles).                                                                                                                                                                           |
| `StatusPill`                          | `status`: done, missed, review, forgiven, disputed, open, none; pair with `entryPill()`.                                                                                                                                                                       |
| `Sheet`                               | Details one tap away: bottom sheet on phones, dialog from 640px; `title` (required), `description`, `footer` (main action last). Focus, Escape and the backdrop are handled. Put "How it works" explanations here.                                             |
| `useToast()`                          | `toast('Saved')` or with one `action` (Undo). Rises above the tab bar and the action bar.                                                                                                                                                                      |
| `Menu`                                | A short list from a button: `trigger={<Button>…</Button>}`, `items` of `{ label, icon, onSelect }`.                                                                                                                                                            |
| `YesNo`                               | Two 64px answer buttons (native radios); `label` is the question.                                                                                                                                                                                              |
| `NumberField`                         | Big digits with `unit`, `target` (says whether it is met), `step` for − and + buttons, `decimals`.                                                                                                                                                             |
| `TextField`                           | Labelled input or `multiline` textarea, 17px, `hint`, `error`.                                                                                                                                                                                                 |
| `Toggle`                              | An on/off row with `label` and `description`.                                                                                                                                                                                                                  |
| `SegmentedControl`                    | 2–4 options with a sliding selection.                                                                                                                                                                                                                          |
| `ProofStrip`                          | Screenshot thumbnails; tap opens them full screen (arrows, ←/→). `onAdd`, `onRemove`. `ProofViewer` alone for custom layouts.                                                                                                                                  |
| `EmptyState`                          | Icon, plain title, one sentence, one action.                                                                                                                                                                                                                   |
| `ActionBar`                           | Sticks the main action (and one secondary) to the bottom of the screen, above the tab bar.                                                                                                                                                                     |
| Motion                                | `Enter` (fade up on mount, `index` staggers), `Stagger` (each child in turn), `CountUp`, `Glide` (swap content with a slide: `id` changes, `direction` ±1), `Item` + `Presence` (lists that add and remove), `motion`, `useReducedMotion`, `EASE`, `DURATION`. |

## Styles

- **Tailwind first.** Layout with Tailwind classes. Colours, type and radii come from the tokens as `nx-*` utilities; use them and never raw colours, so light, dark and every look work:
  - text: `text-nx-ink` (body), `text-nx-ink-2` (secondary), `text-nx-accent`; fills `bg-nx-surface`, `bg-nx-surface-2`, `bg-nx-sunken`, `bg-nx-accent-soft`; lines `border-nx-line`, `border-nx-line-strong`, `border-nx-accent-line`
  - tones: `nx-done`, `nx-missed`, `nx-wait`, `nx-excused`, `nx-ahead`, each with `-soft` (fill) and `-bar` (bars), e.g. `bg-nx-done-soft text-nx-done`
  - type: `text-nx-min` (14px, the floor), `text-nx-2` (15px, secondary), `text-nx-body` (17px), `text-nx-lead` (19px); serif with `font-nx-serif` and `text-nx-h3` (21px), `text-nx-h2` (26px), `text-nx-h1`, and big numbers `text-nx-num` (36px), `text-nx-num-lg` (52px), `text-nx-num-xl`
  - radii `rounded-nx-sm` (12px), `rounded-nx` (18px), `rounded-nx-lg` (24px); shadows `shadow-nx-glass`, `shadow-nx-lift`; `ease-nx`, `animate-nx-enter`
  - the CSS variables behind them (`var(--nx-accent)`, `var(--nx-page)`…) are in `styles/next.css`.
- **Page-specific CSS** goes in a CSS module inside your folder (`week.module.css`). Wrap its rules in `@layer components { … }` so they sit with the kit and Tailwind classes still win:
  ```css
  @layer components {
    .week {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
    }
  }
  ```
- **Never edit** `styles/`, `app/globals.css` or anything outside your folder.
- **No plain global class names of your own.** Today's app styles many common words globally (`active`, `open`, `row`, `primary`, `muted`, `pill`, `done`, `missed`, `today`, `note`, `stat`, `summary`…), and they would leak into your page. Use Tailwind classes, kit components and CSS module class names (which are hashed). Bare elements (`button`, `input`, `textarea`, `h1`–`h3`, `p`, `main`, `a`) are reset inside the new UI, so Tailwind classes on them work as expected.
- **Breakpoints:** phone first. `sm` 640px, `md` 768px, `lg` 1024px (where AppFrame moves its tabs to the top). Check 375px and 1280px.
- **Dark mode** is `data-theme="dark"` on `<html>`; tokens switch by themselves. Avoid `dark:` variants and raw colours.
- **Looks:** the root carries `data-look` from `world.challenge.look`. Any element can carry its own `data-look="sleep"` to show that look's accent inside it (a theme card on Start, for example).

## Motion

150–300 ms, ease-out, never blocking a tap, and nothing moves under `prefers-reduced-motion` (the CSS and the helpers handle it; with Motion directly, use `DURATION` and `EASE` and check `useReducedMotion()` for anything beyond transforms). Worth animating: the page and its sections entering (`Section` and `Enter` do it), sheets (built in), press feedback (built into buttons, rows and cards; `nx-press` for anything else), bars filling (built in), a saved check-in gliding to the next (`Glide`), numbers counting up (`StatButton`, `CountUp`), items leaving a list after Approve (`Presence` + `Item`). Never delay a button until an animation ends.

## Local helpers

When the kit lacks something (a week strip, a calendar, a step indicator), build it as a component in your folder and import it from your versions:

```
components/next/pages/progress/month-grid.tsx
import { MonthGrid } from './month-grid';
```

Build it from kit pieces and tokens, name it for what it shows, and keep it in your folder. Do not import from another page's folder (another builder owns it), and do not change shared files; copy what you need instead.

## Kazzy's rules: the checklist

Every screen of every version passes all of these.

1. **Obvious what to tap.** Exactly one main action per screen, as a filled accent `Button variant="primary"`. Other actions are visibly secondary (`secondary` or `quiet`). Anything tappable looks tappable (kit buttons, rows, cards with chevrons); tap targets at least 44px. Nothing is reachable only by a gesture.
2. **Obvious what the page is for.** The one thing that matters now comes first and largest; details are one tap away (a `Sheet` or another page).
3. **Simple.** Few things per screen, related things grouped, anything that does not help the task removed.
4. **Smooth animation wherever it helps.** Page and section enter, sheets rising and falling, press feedback, bars filling, a saved check-in gliding to the next, numbers counting up. 150–300 ms, ease-out, never blocking a tap, off under reduced motion.
5. **No abstract copy.** No slogans, taglines or cute lines. Plain words. Buttons say exactly what they do: "Save", "Approve", "Sign", "Invite Jordan", "Log Thursday".
6. **No unnecessary copy.** A sentence stays only if it helps someone act or understand. Longer explanations go in a "How it works" sheet or on Rules and help.
7. **No tiny text.** Body 17px, secondary 15px, nothing under 14px anywhere (labels, chips, navigation, timestamps, badges, captions); text inputs at least 16px. Use the `text-nx-*` sizes; `text-xs` and anything under 14px fail `npm run check`.
8. **Every number does something.** Each statistic is a `StatButton` or a row or link that opens what you would act on.
9. **No useless numbers.** Show a number only if it answers something couples ask: what is left to log, what waits for review, who is ahead, what the gift is at, how many gym days are left this week, a streak worth protecting.

And: light and dark both look right (tokens only), phone first and still good on a laptop, visible keyboard focus (built into the kit; keep `:focus-visible` outlines on your own controls), real labels on inputs (`TextField`, `NumberField` and `YesNo` have them), good contrast (`text-nx-ink-2` is the lightest text colour).

## Done means

- Your folder's versions are real designs; each starts with its one-line comment; `index.ts` lists them all.
- Each version works at 375px and 1280px, in light and dark, and in at least Classic and one other look.
- `npm run format`, `npm run check` and `npm run build` pass.
- You changed nothing outside your folder.
