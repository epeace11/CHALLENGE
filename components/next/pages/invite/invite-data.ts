import type { Challenge, Person, Rule, World } from '@/lib/next/model';
import { SUN_THU } from '@/lib/next/catalog';
import {
  dateIn,
  formatDay,
  formatDeadline,
  formatMoney,
  formatNumber,
  formatTime,
  formatWeekdays,
  formatWhen,
  lastDay,
  lockTime,
  partnerOf,
  personById,
  shift,
} from '@/lib/next/selectors';

/**
 * What Jordan sees when he opens Maya's invite, worked out from the sample world. The invite's
 * sender is the inviter (Maya); the other person of the couple is the viewer (Jordan), so the page
 * talks to him as "you" even though the preview's `world.me` is Maya.
 */

export type RuleGroupView = {
  key: 'both' | 'you' | 'them';
  /** "Both of you", "Only you", "Only Maya". */
  title: string;
  /** For a switch: "Both of you", "You", "Maya". */
  short: string;
  people: Person[];
  rules: Rule[];
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

/** "Toronto" from "America/Toronto". */
const placeOf = (timeZone: string) =>
  (timeZone.split('/').pop() ?? timeZone).replace(/_/g, ' ');

export function inviteView(world: World) {
  const c = world.challenge;
  const inviter = personById(world, world.invite.from) ?? world.me;
  const you = partnerOf(world, inviter.id);
  const groups: RuleGroupView[] = (
    [
      {
        key: 'both',
        title: 'Both of you',
        short: 'Both of you',
        people: [you, inviter],
        rules: c.rules.filter((r) => r.who === 'both'),
      },
      {
        key: 'you',
        title: 'Only you',
        short: 'You',
        people: [you],
        rules: c.rules.filter((r) => r.who === you.id),
      },
      {
        key: 'them',
        title: `Only ${inviter.name}`,
        short: inviter.name,
        people: [inviter],
        rules: c.rules.filter((r) => r.who === inviter.id),
      },
    ] satisfies RuleGroupView[]
  ).filter((g) => g.rules.length > 0);
  const step = (n: number) => formatMoney(c.step * n);
  // The first day's check-in locks at the deadline ("Tuesday, Nov 3 at 11:59 pm").
  const firstLock = lockTime(c, c.start);
  return {
    challenge: c,
    inviter,
    you,
    groups,
    start: formatDay(c.start),
    end: formatDay(lastDay(c)),
    place: placeOf(c.timeZone),
    step: step(1),
    steps: [step(1), step(2), step(3)] as const,
    deadline: formatDeadline(c.deadline),
    firstCheckin: {
      day: formatDay(c.start),
      until: `${formatDay(dateIn(c.timeZone, firstLock))} at ${formatTime(firstLock, c.timeZone)}`,
    },
    how: [
      `Check in by ${formatDeadline(c.deadline)} and review each other’s answers.`,
      `Each miss adds the next step to the gift you owe ${inviter.name}: ${step(1)}, then ${step(2)}, then ${step(3)}.`,
    ] as const,
  };
}

/* ── Suggest a change: one thing, and what it should be instead ──────────── */

/** `rule:<id>` for a rule, or one of the challenge's settings. */
export type Topic =
  | `rule:${string}`
  | 'start'
  | 'length'
  | 'step'
  | 'deadline'
  | 'other';

export const ruleTopic = (ruleId: string): Topic => `rule:${ruleId}`;

/** The choices, grouped: every rule, then the challenge's settings with their current values. */
export function topicOptions(c: Challenge) {
  return {
    rules: c.rules.map((r) => ({ value: ruleTopic(r.id), label: r.title })),
    settings: [
      { value: 'start', label: `Start date (${formatDay(c.start)})` },
      { value: 'length', label: `Length (${c.days} days)` },
      { value: 'step', label: `Dollar step (${formatMoney(c.step)})` },
      { value: 'deadline', label: `Deadline (${formatDeadline(c.deadline)})` },
      { value: 'other', label: 'Something else' },
    ] satisfies { value: Topic; label: string }[],
  };
}

/** What the suggestion is about, in a few words: "Gym, 4 days a week", "Start date". */
export function topicLabel(c: Challenge, topic: Topic) {
  if (topic.startsWith('rule:'))
    return c.rules.find((r) => `rule:${r.id}` === topic)?.title ?? 'A rule';
  return {
    start: 'Start date',
    length: 'Length',
    step: 'Dollar step',
    deadline: 'Deadline',
    other: 'Something else',
  }[topic as Exclude<Topic, `rule:${string}`>];
}

/** An example answer for the text field, so it is clear what to write. */
export function topicExample(c: Challenge, topic: Topic) {
  if (topic.startsWith('rule:')) {
    const rule = c.rules.find((r) => `rule:${r.id}` === topic);
    if (!rule) return 'For example: leave this rule out';
    if (rule.kind === 'weekly' && rule.weeklyTarget)
      return `For example: ${rule.weeklyTarget - 1} days a week instead of ${rule.weeklyTarget}`;
    if (rule.kind === 'number' && rule.target) {
      const { op, value, unit } = rule.target;
      const other =
        op === '<=' ? value + Math.max(1, Math.round(value / 2)) : value * 0.8;
      return `For example: ${formatNumber(Math.round(other))} ${unit} instead of ${formatNumber(value)}`;
    }
    return rule.days.length === 7
      ? `For example: only ${formatWeekdays(SUN_THU)}`
      : 'For example: every day';
  }
  switch (topic) {
    case 'start':
      return `For example: start ${formatDay(shift(c.start, 7))}`;
    case 'length':
      return `For example: ${Math.max(7, c.days - 9)} days`;
    case 'step':
      return `For example: ${formatMoney(c.step / 2)} instead of ${formatMoney(c.step)}`;
    case 'deadline':
      return 'For example: noon the next day';
    default:
      return 'Say what you would change';
  }
}
