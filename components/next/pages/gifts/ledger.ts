import type {
  Entry,
  ForgivenessRequest,
  Person,
  Point,
  Rule,
  World,
} from '@/lib/next/model';
import { forgivePoint } from '@/lib/next/actions';
import {
  activePoints,
  countsForWeek,
  formatValue,
  gets,
  leader,
  nextMissCost,
  partnerOf,
  pointCost,
  pointHistory,
  ruleById,
  weekOf,
  weekTarget,
} from '@/lib/next/selectors';

/**
 * What the Gifts page shows, worked out from the sample world and shared by both versions: each
 * gift from the recipient's side, and the points behind it with what each one cost.
 */

/** One point in a person's history. */
export type PointRow = {
  point: Point;
  rule: Rule;
  /** What it adds to the gift now: its place times the step; 0 once forgiven. */
  cost: number;
  forgiven: boolean;
  /** Why it is a point, in a few words: "Answered No", "95 min", "Not logged". */
  why: string;
  /** The note its owner wrote with the answer. */
  note: string;
  /** A forgiveness request waiting on the other person. */
  pending?: ForgivenessRequest;
  /** The latest request on it, whatever became of it. */
  latest?: ForgivenessRequest;
};

function whyText(w: World, point: Point, rule: Rule, entry?: Entry) {
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

/** A person's points, oldest first (the order that sets their price), forgiven ones included. */
export function ledger(w: World, personId: string): PointRow[] {
  return pointHistory(w, personId).flatMap((point) => {
    const rule = ruleById(w.challenge, point.ruleId);
    if (!rule) return [];
    const entry = point.entryId
      ? w.entries.find((e) => e.id === point.entryId)
      : undefined;
    const requests = w.requests
      .filter((r) => r.pointId === point.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return [
      {
        point,
        rule,
        cost: pointCost(w, point),
        forgiven: point.forgiven,
        why: whyText(w, point, rule, entry),
        note: entry?.note ?? '',
        pending: point.forgiven
          ? undefined
          : requests.find((r) => r.status === 'pending'),
        latest: requests.at(-1),
      },
    ];
  });
}

/** One gift, told from the side of the person who receives it. */
export type Gift = {
  recipient: Person;
  /** Whose points set it. */
  payer: Person;
  amount: number;
  /** The payer's active points. */
  points: number;
  /** What the payer's next miss adds (0 at the cap). */
  nextMiss: number;
  /** How many points fewer the recipient has than the payer, when they are ahead. */
  ahead: number | null;
};

export function giftFor(w: World, recipient: Person): Gift {
  const payer = partnerOf(w, recipient.id);
  const lead = leader(w);
  return {
    recipient,
    payer,
    amount: gets(w, recipient.id),
    points: activePoints(w, payer.id).length,
    nextMiss: nextMissCost(w, payer.id),
    ahead: lead.personId === recipient.id ? lead.margin : null,
  };
}

/** The gift a point sets, now and once the point is forgiven. */
export function forgiveEffect(w: World, point: Point) {
  const recipient = partnerOf(w, point.personId);
  return {
    recipient,
    now: gets(w, recipient.id),
    after: gets(forgivePoint(w, point.id), recipient.id),
  };
}
