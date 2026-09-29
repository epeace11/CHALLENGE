import type { Instant, Person, Rule, World } from '@/lib/next/model';
import { signPact } from '@/lib/next/actions';
import {
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
  personById,
  rulesFor,
  zonedTime,
} from '@/lib/next/selectors';

/**
 * The pact as Jordan sees it: Maya (who sent the invite) has signed, Jordan has not. The page talks
 * to Jordan as "you" even though the preview's `world.me` is Maya.
 */

/** "Saturday, Oct 31 at 9:14 pm" in the challenge's time zone. */
export const dayAndTime = (at: Instant | number, timeZone: string) =>
  `${formatDay(dateIn(timeZone, at))} at ${formatTime(at, timeZone)}`;

/** "11:59 pm" from '23:59'. */
const clock = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};

/** A rule's second line: "Sun–Thu", "Every day · Screenshot", "4 days a week". */
export function ruleDetail(rule: Rule) {
  const proof =
    rule.proof === 'required'
      ? 'Screenshot'
      : rule.proof === 'optional'
        ? 'Screenshot optional'
        : null;
  return [formatWhen(rule), proof].filter(Boolean).join(' · ');
}

/**
 * The pact is signed before Day 1, but the sample world is frozen on Day 19. So this page is set at
 * the moment Jordan opens it: half an hour after Maya signed (Saturday, Oct 31, 9:44 pm), or at the
 * world's own `now` while that is still before Day 1. Epoch milliseconds.
 */
export function pactMoment(world: World, inviterId: string) {
  const c = world.challenge;
  const start = zonedTime(c.start, '00:00', c.timeZone);
  if (ms(world.now) < start) return ms(world.now);
  const theirs = world.pact.signatures.find(
    (s) => s.personId === inviterId,
  )?.signedAt;
  const base = Math.max(ms(world.invite.sentAt), theirs ? ms(theirs) : 0);
  return Math.min(base + 30 * 6e4, start - 6e4);
}

/** Signs for `personId` at `at` rather than at the world's `now` (the page's moment, before Day 1). */
export function signPactAt(w: World, personId: string, at: Instant): World {
  return { ...signPact({ ...w, now: at }, personId), now: w.now };
}

export type Signer = {
  person: Person;
  /** True for Jordan, the viewer. */
  you: boolean;
  signedAt: Instant | null;
  /** Every rule this person checks in on. */
  rules: Rule[];
};

export type RuleGroupView = {
  key: 'both' | 'you' | 'them';
  title: string;
  people: Person[];
  rules: Rule[];
};

export function pactView(world: World) {
  const c = world.challenge;
  const inviter = personById(world, world.invite.from) ?? world.me;
  const you = partnerOf(world, inviter.id);
  const signedAt = (id: string) =>
    world.pact.signatures.find((s) => s.personId === id)?.signedAt ?? null;
  const signer = (person: Person, isYou: boolean): Signer => ({
    person,
    you: isYou,
    signedAt: signedAt(person.id),
    rules: rulesFor(c, person.id),
  });
  const moment = pactMoment(world, inviter.id);
  const left = Math.max(0, zonedTime(c.start, '00:00', c.timeZone) - moment);
  const firstLock = lockTime(c, c.start);
  const step = (n: number) => formatMoney(c.step * n);
  const groups: RuleGroupView[] = (
    [
      {
        key: 'both',
        title: 'Both of you',
        people: [you, inviter],
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
        title: `Only ${inviter.name}`,
        people: [inviter],
        rules: c.rules.filter((r) => r.who === inviter.id),
      },
    ] satisfies RuleGroupView[]
  ).filter((g) => g.rules.length > 0);
  const yours = signer(you, true),
    theirs = signer(inviter, false);
  return {
    challenge: c,
    inviter,
    you,
    /** Jordan, then Maya. */
    signers: [yours, theirs] as const,
    yours,
    theirs,
    bothSigned: world.pact.signatures.every((s) => !!s.signedAt),
    /** When Jordan signs, as an instant. */
    signAt: new Date(moment).toISOString(),
    countdown: {
      days: Math.floor(left / 864e5),
      hours: Math.floor((left % 864e5) / 36e5),
    },
    groups,
    terms: world.pact.terms,
    start: formatDay(c.start),
    startDate: formatDate(c.start),
    startWeekday: formatWeekday(c.start),
    end: formatDay(lastDay(c)),
    place: (c.timeZone.split('/').pop() ?? c.timeZone).replace(/_/g, ' '),
    step: step(1),
    steps: [step(1), step(2), step(3)] as const,
    deadlineClock: clock(c.deadline.time),
    firstCheckin: {
      day: formatDay(c.start),
      until: dayAndTime(firstLock, c.timeZone),
    },
  };
}
