import type { Challenge, Instant, Person, Rule, World } from '@/lib/next/model';
import { signPact } from '@/lib/next/actions';
import {
  asIfSignedToday,
  dateIn,
  formatDate,
  formatDay,
  formatMoney,
  formatTime,
  formatWeekday,
  formatWhen,
  lastDay,
  lockTime,
  ms,
  partnerOf,
  rulesFor,
  stakesPreview,
  zonedTime,
} from '@/lib/next/selectors';

/** What the stakes assume: each of you misses 1 check-in in 10. */
const MISS_RATE = 0.1;

/**
 * The pact from one person's side, `you`: in the live app always the viewer (`world.me`); in the
 * preview, Jordan, who was invited and hasn't signed (Maya, the preview's `world.me`, signed when
 * she sent the invite). See `pactViewer`.
 */

/** Whose side the pact page shows: the viewer in the live app, the invited partner in the preview. */
export const pactViewer = (world: World, live: boolean) =>
  live ? world.me : partnerOf(world, world.invite.from);

/** "Saturday, Oct 31 at 9:14 pm" in the challenge's time zone. */
export const dayAndTime = (at: Instant | number, timeZone: string) =>
  `${formatDay(dateIn(timeZone, at))} at ${formatTime(at, timeZone)}`;

/** "11:59 pm" from '23:59'. */
const clock = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};

/**
 * A rule's second line: "Sun–Thu", "Every day · Screenshot". It leaves out what the title already
 * says ("Gym, 4 days a week" needs no "4 days a week"), so it can be empty.
 */
export function ruleDetail(rule: Rule) {
  const when = formatWhen(rule);
  const proof =
    rule.proof === 'required'
      ? 'Screenshot'
      : rule.proof === 'optional'
        ? 'Screenshot optional'
        : null;
  const said = rule.title.toLowerCase().includes(when.toLowerCase());
  return [said ? null : when, proof].filter(Boolean).join(' · ');
}

/**
 * The pact is signed before Day 1, but the sample world is frozen on Day 19. So this page is set at
 * the moment Jordan opens it: half an hour after Maya signed (Saturday, Oct 31, 9:44 pm), or at the
 * world's own `now` while that is still before Day 1 (always, in the live app). `otherId` is the
 * one who signed first. Epoch milliseconds.
 */
export function pactMoment(world: World, otherId: string) {
  const c = asIfSignedToday(world.challenge, world.today);
  const start = zonedTime(c.start, '00:00', c.timeZone);
  if (ms(world.now) < start) return ms(world.now);
  const theirs = world.pact.signatures.find(
    (s) => s.personId === otherId,
  )?.signedAt;
  const base = Math.max(ms(world.invite.sentAt), theirs ? ms(theirs) : 0);
  return Math.min(base + 30 * 6e4, start - 6e4);
}

/** Signs for `personId` at `at` rather than at the world's `now` (the page's moment, before Day 1). */
export function signPactAt(
  w: World,
  personId: string,
  at: Instant,
  limits: Record<string, number> = {},
): World {
  return { ...signPact({ ...w, now: at }, personId, limits), now: w.now };
}

/**
 * The pact as the one who set it up sees it in the preview, opened from Set up: the challenge as
 * drafted, nobody signed (or only them, at `signedAt`), and the partner not invited yet.
 */
export function asSetter(
  w: World,
  drafted: Challenge,
  signedAt: Instant | null,
): World {
  return {
    ...w,
    challenge: { ...drafted, status: 'invited' },
    pact: {
      ...w.pact,
      signatures: w.pact.signatures.map((s) => ({
        ...s,
        signedAt: s.personId === w.me.id ? signedAt : null,
      })),
    },
    partnerPending: true,
  };
}

export type Signer = {
  person: Person;
  /** True for the one the page speaks to as "you". */
  you: boolean;
  signedAt: Instant | null;
};

export type RuleGroupView = {
  key: 'both' | 'you' | 'them';
  title: string;
  people: Person[];
  rules: Rule[];
};

/** Everything the pact page shows, from `you`'s side (see `pactViewer`). */
export function pactView(world: World, you: Person) {
  // Before both have signed, the first day it will be (never before the day after both sign).
  const c = asIfSignedToday(world.challenge, world.today);
  // The other one: Maya in the preview, the partner in the live app.
  const other = partnerOf(world, you.id);
  const signedAt = (id: string) =>
    world.pact.signatures.find((s) => s.personId === id)?.signedAt ?? null;
  const signer = (person: Person, isYou: boolean): Signer => ({
    person,
    you: isYou,
    signedAt: signedAt(person.id),
  });
  const moment = pactMoment(world, other.id);
  const left = Math.max(0, zonedTime(c.start, '00:00', c.timeZone) - moment);
  const firstLock = lockTime(c, c.start);
  const stakes = stakesPreview(c, MISS_RATE, [you.id, other.id]);
  const groups: RuleGroupView[] = (
    [
      {
        key: 'both',
        title: 'Both of you',
        people: [you, other],
        rules: c.rules.filter((r) => r.who === 'both'),
      },
      {
        key: 'you',
        title: 'Only you',
        people: [you],
        rules: c.rules.filter((r) => r.who === you.id),
      },
      {
        key: 'them',
        title: `Only ${other.name}`,
        people: [other],
        rules: c.rules.filter((r) => r.who === other.id),
      },
    ] satisfies RuleGroupView[]
  ).filter((g) => g.rules.length > 0);
  const yours = signer(you, true),
    theirs = signer(other, false);
  return {
    challenge: c,
    /** The other one, who signs (or signed) alongside `you`. */
    other,
    you,
    /** You, then the other one. */
    signers: [yours, theirs] as const,
    yours,
    theirs,
    bothSigned: world.pact.signatures.every((s) => !!s.signedAt),
    /** When you sign, as an instant. */
    signAt: new Date(moment).toISOString(),
    countdown: {
      days: Math.floor(left / 864e5),
      hours: Math.floor((left % 864e5) / 36e5),
    },
    groups,
    /** Rules where each person sets their own target, which `you` sets when signing. */
    limitRules: rulesFor(c, you.id).filter(
      (r) => r.kind === 'number' && r.personalTarget && !!r.target,
    ),
    terms: world.pact.terms,
    start: formatDay(c.start),
    startDate: formatDate(c.start),
    startWeekday: formatWeekday(c.start),
    end: formatDay(lastDay(c)),
    place: (c.timeZone.split('/').pop() ?? c.timeZone).replace(/_/g, ' '),
    /** What a gift comes to if each of you misses 1 check-in in 10: what signing puts at stake. */
    stakes: formatMoney(stakes.gift),
    /** The 10 of "1 in 10". */
    missEvery: Math.round(1 / MISS_RATE),
    /** About how many points each of you has at that rate, which is what sets that gift. */
    stakesPoints: Math.round(
      stakes.perPerson.reduce((sum, p) => sum + p.misses, 0) /
        Math.max(1, stakes.perPerson.length),
    ),
    deadlineClock: clock(c.deadline.time),
    firstCheckin: {
      until: dayAndTime(firstLock, c.timeZone),
    },
  };
}
