import type {
  Challenge,
  DateString,
  Deadline,
  Person,
  Rule,
} from '@/lib/next/model';
import {
  formatDayShort,
  formatMoney,
  formatTarget,
  formatWhen,
  lastDay,
  plural,
  stakesPreview,
} from '@/lib/next/selectors';

/**
 * The challenge being set up, before Jordan is invited. It starts as a copy of the sample
 * challenge's settings and rules and changes only on this page (the sample world's challenge is
 * already running, so nothing here writes back to it).
 */
export type Draft = {
  name: string;
  start: DateString;
  /** Null while the length field is empty. */
  days: number | null;
  timeZone: string;
  deadline: Deadline;
  step: number;
  /** Whether gifts are capped; `cap` keeps its amount while the switch is off or the field is empty. */
  capOn: boolean;
  cap: number | null;
  rules: Rule[];
};

export const draftFrom = (c: Challenge): Draft => ({
  name: c.name,
  start: c.start,
  days: c.days,
  timeZone: c.timeZone,
  deadline: c.deadline,
  step: c.step,
  capOn: c.cap !== null,
  cap: c.cap,
  rules: c.rules,
});

/** The cap that applies: null when it is off or not filled in. */
export const draftCap = (d: Pick<Draft, 'capOn' | 'cap'>) =>
  d.capOn ? d.cap : null;

export const MIN_DAYS = 1;
export const MAX_DAYS = 365;

/** How many days the draft runs, while the length field may be empty. */
export const draftDays = (d: Pick<Draft, 'days'>) =>
  Math.min(MAX_DAYS, Math.max(MIN_DAYS, d.days ?? MIN_DAYS));

/** "Mon, Nov 2 – Tue, Dec 1" */
export const rangeLine = (start: DateString, days: number) =>
  `${formatDayShort(start)} – ${formatDayShort(lastDay({ start, days }))}`;

/** "Miss 1 in 10 check-ins and each gift will be about $150", for the draft's rules and stakes. */
export function draftStakes(
  d: Pick<Draft, 'rules' | 'start' | 'days' | 'step' | 'capOn' | 'cap'>,
  people: Person[],
) {
  return stakesPreview(
    {
      rules: d.rules,
      start: d.start,
      days: draftDays(d),
      step: d.step,
      cap: draftCap(d),
      weekStart: 1,
    },
    0.1,
    people.map((p) => p.id),
  );
}

/* ── Stakes ────────────────────────────────────────────────────────────── */

/** What the first point can cost. */
export const STEPS = [0.25, 0.5, 1, 2, 5];

/** "The first point costs $1, the second $2, the third $3, and so on." */
export const stepLine = (step: number) =>
  `The first point costs ${formatMoney(step)}, the second ${formatMoney(step * 2)}, the third ${formatMoney(step * 3)}, and so on.`;

/** The cap suggested when the cap is switched on, until it is changed. */
export const DEFAULT_CAP = 100;

/* ── Deadline ──────────────────────────────────────────────────────────── */

export const DEADLINES: { id: string; label: string; deadline: Deadline }[] = [
  {
    id: 'same',
    label: 'The same day',
    deadline: { daysAfter: 0, time: '23:59' },
  },
  {
    id: 'next',
    label: 'The next day',
    deadline: { daysAfter: 1, time: '23:59' },
  },
];

export const deadlineId = (d: Deadline) =>
  DEADLINES.find(
    (o) => o.deadline.daysAfter === d.daysAfter && o.deadline.time === d.time,
  )?.id ?? 'next';

/** "11:59 pm" from '23:59'. */
export function clock(time: string) {
  const [h, m] = time.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

/** An example of the deadline: "Thursday’s check-ins close at 11:59 pm on Friday." */
export function deadlineLine(d: Deadline) {
  const when =
    d.daysAfter === 0
      ? 'that night'
      : d.daysAfter === 1
        ? 'on Friday'
        : `${d.daysAfter} days later`;
  return `Thursday’s check-ins close at ${clock(d.time)} ${when}.`;
}

/* ── Time zones ────────────────────────────────────────────────────────── */

export const TIME_ZONES: { id: string; city: string; region: string }[] = [
  { id: 'America/Toronto', city: 'Toronto', region: 'Eastern time' },
  { id: 'America/New_York', city: 'New York', region: 'Eastern time' },
  { id: 'America/Chicago', city: 'Chicago', region: 'Central time' },
  { id: 'America/Denver', city: 'Denver', region: 'Mountain time' },
  { id: 'America/Los_Angeles', city: 'Los Angeles', region: 'Pacific time' },
  { id: 'America/Vancouver', city: 'Vancouver', region: 'Pacific time' },
  { id: 'Europe/London', city: 'London', region: 'UK time' },
  { id: 'Australia/Sydney', city: 'Sydney', region: 'Eastern Australia' },
];

export const zoneCity = (id: string) =>
  TIME_ZONES.find((z) => z.id === id)?.city ??
  id.split('/').pop()?.replace(/_/g, ' ') ??
  id;

export const zoneRegion = (id: string) =>
  TIME_ZONES.find((z) => z.id === id)?.region ?? id;

/* ── Rules ─────────────────────────────────────────────────────────────── */

/** "Sun–Thu", "Every day · 60 min or less · Screenshot required", "Any 4 days, Monday to Sunday". */
export function ruleSummary(rule: Rule) {
  const parts = [
    rule.kind === 'weekly'
      ? `Any ${plural(rule.weeklyTarget ?? 0, 'day')}, Monday to Sunday`
      : formatWhen(rule),
  ];
  if (rule.kind === 'number' && rule.target)
    parts.push(
      rule.personalTarget
        ? 'Each sets their own limit'
        : formatTarget(rule.target),
    );
  if (rule.proof === 'required') parts.push('Screenshot required');
  else if (rule.proof === 'optional') parts.push('Screenshot optional');
  return parts.join(' · ');
}

export const whoName = (who: string, me: Person, partner: Person) =>
  who === 'both'
    ? 'Both of you'
    : who === me.id
      ? me.name
      : who === partner.id
        ? partner.name
        : who;

export type RulesByWho = {
  key: string;
  title: string;
  people: Person[];
  rules: Rule[];
};

/** The rules grouped as Both of you, the viewer, and the partner, in that order. Empty groups are left out. */
export function rulesByWho(rules: Rule[], me: Person, partner: Person) {
  const groups: RulesByWho[] = [
    {
      key: 'both',
      title: 'Both of you',
      people: [me, partner],
      rules: rules.filter((r) => r.who === 'both'),
    },
    {
      key: me.id,
      title: me.name,
      people: [me],
      rules: rules.filter((r) => r.who === me.id),
    },
    {
      key: partner.id,
      title: partner.name,
      people: [partner],
      rules: rules.filter((r) => r.who === partner.id),
    },
  ];
  return groups.filter((g) => g.rules.length > 0);
}

const sameTitle = (a: Rule, b: Rule) =>
  a.title.trim().toLowerCase() === b.title.trim().toLowerCase();

/** The draft's rule that a library rule stands for: the same id, or the same title. */
export const matchingRule = (rules: Rule[], libraryRule: Rule) =>
  rules.find((r) => r.id === libraryRule.id || sameTitle(r, libraryRule));

/** A fresh id for a rule built here. */
export function newRuleId(rules: Rule[]) {
  let n = 1;
  while (rules.some((r) => r.id === `custom-${n}`)) n++;
  return `custom-${n}`;
}
