import type {
  DateString,
  Entry,
  Point,
  Proof,
  Rule,
  World,
} from '@/lib/next/model';
import { concede, decideForgiveness } from '@/lib/next/actions';
import {
  countsForWeek,
  formatValue,
  gets,
  plural,
  repliedDisputes,
  reviewQueue,
  waitingOnPartner,
  weekOf,
  weekTarget,
  type ReviewItem,
} from '@/lib/next/selectors';

/**
 * What the Review page shows, worked out from the sample world. Shared by every version so they
 * differ only in layout and motion. Pure functions of a World.
 */

export type AnswerItem = Extract<ReviewItem, { kind: 'answer' }>;
export type LateItem = Extract<ReviewItem, { kind: 'correction' }>;
export type ForgiveItem = Extract<ReviewItem, { kind: 'forgiveness' }>;
export type DisputeItem = Extract<ReviewItem, { kind: 'dispute' }>;
export type { ReviewItem };

/** The partner's answers for one day, which "Approve all" approves together. */
export type DayGroup = { day: DateString; items: AnswerItem[] };

/**
 * The viewer's review: `todo` is everything waiting on them, in the order the page meets it
 * (answers by day, late answers, forgiveness requests, then disputes on their own answers).
 * A dispute they already replied to waits on the partner, so it moves to `replied`.
 * `theirs` is the partner's queue: the viewer's own answers and requests still waiting.
 */
export function reviewState(w: World) {
  const q = reviewQueue(w, w.me.id);
  const days: DayGroup[] = [];
  const answers = [...q.answers].sort(
    (a, b) =>
      a.entry.day.localeCompare(b.entry.day) || a.at.localeCompare(b.at),
  );
  for (const a of answers) {
    const group = days.find((g) => g.day === a.entry.day);
    if (group) group.items.push(a);
    else days.push({ day: a.entry.day, items: [a] });
  }
  const disputes = q.disputes;
  const replied = repliedDisputes(w, w.me.id);
  const todo: ReviewItem[] = [
    ...days.flatMap((g) => g.items),
    ...q.corrections,
    ...q.forgiveness,
    ...disputes,
  ];
  const theirs = waitingOnPartner(w, w.me.id);
  return {
    todo,
    days,
    late: q.corrections,
    forgiveness: q.forgiveness,
    disputes,
    replied,
    theirs,
    /** Everything waiting on the partner, the viewer's replied disputes included. */
    waiting: theirs.count + replied.length,
  };
}

export type ReviewState = ReturnType<typeof reviewState>;

/** The answer an item asks about: a late answer's proposal, or the answer itself. */
export type Shown = {
  done: boolean | null;
  value?: number;
  note: string;
  proofs: Proof[];
};
export const shownAnswer = (item: AnswerItem | LateItem): Shown =>
  item.kind === 'correction' && item.entry.correction
    ? item.entry.correction
    : item.entry;

/** Why a point is a point, in a few words: "Answered No", "95 min", "Not logged", "3 of 4 that week". */
export function missWhy(w: World, point: Point, rule: Rule, entry?: Entry) {
  if (point.reason === 'unlogged') return 'Not logged';
  if (point.reason === 'conceded') return 'Conceded after a dispute';
  if (point.reason === 'weekly') {
    const week = weekOf(w.challenge, point.day);
    if (!week) return 'Short that week';
    const have = w.entries.filter(
      (e) =>
        e.personId === point.personId &&
        e.ruleId === rule.id &&
        e.day >= week.start &&
        e.day <= week.end &&
        countsForWeek(e),
    ).length;
    return `${have} of ${weekTarget(rule, week, w.challenge)} that week`;
  }
  return rule.kind === 'number' && entry?.value !== undefined
    ? formatValue(rule, entry.value)
    : 'Answered No';
}

/** The viewer's gift now, and after forgiving the point a request is about. */
export const forgiveEffect = (w: World, item: ForgiveItem) => ({
  now: gets(w, w.me.id),
  after: gets(decideForgiveness(w, item.request.id, 'approved'), w.me.id),
});

/** The partner's gift now, and after the viewer concedes a dispute (the answer becomes a point). */
export const concedeEffect = (w: World, item: DisputeItem) => ({
  now: gets(w, w.partner.id),
  after: gets(concede(w, item.dispute.id), w.partner.id),
});

/** "Approve both", "Approve all 3". */
export const approveAllLabel = (n: number) =>
  n === 2 ? 'Approve both' : `Approve all ${n}`;

/** A rule's name without its target, for tight rows: "Social media and games" (a number's own comma stays). */
export const shortTitle = (rule: Rule) => rule.title.split(', ')[0];

/** What waits on the partner, in words: "1 answer", "1 answer, 1 dispute". */
export function waitingSummary(s: ReviewState) {
  const parts: string[] = [];
  const answers = s.theirs.answers.length + s.theirs.corrections.length;
  if (answers) parts.push(plural(answers, 'answer'));
  if (s.theirs.forgiveness.length)
    parts.push(plural(s.theirs.forgiveness.length, 'forgiveness request'));
  const disputes = s.theirs.disputes.length + s.replied.length;
  if (disputes) parts.push(plural(disputes, 'dispute'));
  return parts.join(', ');
}

/** The main action and its alternative for each kind of item, in the words the buttons use. */
export const ACTIONS: Record<
  ReviewItem['kind'],
  { main: string; alt: string }
> = {
  answer: { main: 'Approve', alt: 'Dispute' },
  correction: { main: 'Approve', alt: 'Decline' },
  forgiveness: { main: 'Forgive', alt: 'Decline' },
  dispute: { main: 'Concede', alt: 'Keep it open' },
};
