import {
  BookOpen,
  Dumbbell,
  GlassWater,
  House,
  Moon,
  PiggyBank,
  Smartphone,
  Utensils,
  type LucideIcon,
} from 'lucide-react';
import type {
  ProofNeed,
  Rule,
  RuleGroup,
  SayRulesDraft,
  Weekday,
  World,
} from '@/lib/next/model';
import { EVERY_DAY, MON_FRI, SUN_THU } from '@/lib/next/catalog';
import { formatNumber, formatWeekdays, nameOf } from '@/lib/next/selectors';

/** Plain helpers for Say your rules: the words on a drafted rule, day presets, and the drafting script. */

export const GROUP_ICON: Record<RuleGroup, LucideIcon> = {
  Sleep: Moon,
  Screens: Smartphone,
  Food: Utensils,
  Drinks: GlassWater,
  Movement: Dumbbell,
  Mind: BookOpen,
  Money: PiggyBank,
  Home: House,
};

/** How long the pretend drafting takes, and when each part of the sentence lights up. */
export const DRAFT_MS = 1500;
export const PHRASE_MS = [200, 600, 1000];

/**
 * The part of the sample sentence each drafted rule came from, lit up one after another while
 * drafting. A sentence the couple typed themselves simply has nothing lit.
 */
const SOURCES: Record<string, string> = {
  'say-bed': 'in bed by 11 on weeknights and read till we fall asleep',
  'say-phones': 'no phones in the bedroom',
  'say-steps': '10k steps every day with a screenshot',
};

/** The sentence cut into plain and lit pieces; `step` is which rule's phrase it is (1, 2, 3), or 0. */
export function sentencePieces(sentence: string, rules: Rule[]) {
  const marks = rules
    .map((r, i) => {
      const phrase = SOURCES[r.id];
      const at = phrase ? sentence.indexOf(phrase) : -1;
      return at < 0 ? null : { at, end: at + phrase.length, step: i + 1 };
    })
    .filter((m): m is { at: number; end: number; step: number } => !!m)
    .sort((a, b) => a.at - b.at);
  const pieces: { text: string; step: number }[] = [];
  let cursor = 0;
  for (const m of marks) {
    if (m.at < cursor) continue;
    if (m.at > cursor)
      pieces.push({ text: sentence.slice(cursor, m.at), step: 0 });
    pieces.push({ text: sentence.slice(m.at, m.end), step: m.step });
    cursor = m.end;
  }
  if (cursor < sentence.length)
    pieces.push({ text: sentence.slice(cursor), step: 0 });
  return pieces;
}

/** Keeps "11 pm" and "7 am" on one line when a title wraps. */
export const keepTogether = (title: string) =>
  title.replace(/(\d) (am|pm)\b/g, '$1\u00a0$2');

/** Day presets for editing a drafted rule. */
export const DAY_PRESETS: { id: string; label: string; days: Weekday[] }[] = [
  { id: 'every', label: 'Every day', days: EVERY_DAY },
  { id: 'sun-thu', label: 'Sun–Thu', days: SUN_THU },
  { id: 'mon-fri', label: 'Mon–Fri', days: MON_FRI },
  { id: 'weekends', label: 'Weekends', days: [0, 6] },
];

const byDay = (x: Weekday, y: Weekday) => x - y;

export const sameDays = (a: readonly Weekday[], b: readonly Weekday[]) =>
  a.length === b.length &&
  [...a].sort(byDay).join() === [...b].sort(byDay).join();

export const presetOf = (days: readonly Weekday[]) =>
  DAY_PRESETS.find((p) => sameDays(p.days, days))?.id ?? 'custom';

/** "Both of you", "You", "Jordan". */
export function whoWord(w: World, who: Rule['who']) {
  if (who === 'both') return 'Both of you';
  return who === w.me.id ? 'You' : nameOf(w, who);
}

const UNIT_WORD: Record<string, string> = {
  min: 'minutes',
  h: 'hours',
  L: 'litres',
  kcal: 'calories',
};

export const unitWord = (unit: string) => UNIT_WORD[unit] ?? unit;

/** "Yes or No", "Number of steps, 10,000 or more". */
export function answerWord(rule: Rule) {
  if (rule.kind !== 'number' || !rule.target) return 'Yes or No';
  const t = rule.target;
  return `Number of ${unitWord(t.unit)}, ${formatNumber(t.value)} or ${t.op === '>=' ? 'more' : 'less'}`;
}

/** "Yes or No", "Steps, 10,000 or more": the short form for one-line rows. */
export function shortAnswer(rule: Rule) {
  if (rule.kind !== 'number' || !rule.target) return 'Yes or No';
  const t = rule.target,
    unit = unitWord(t.unit);
  return `${unit[0].toUpperCase()}${unit.slice(1)}, ${formatNumber(t.value)} or ${t.op === '>=' ? 'more' : 'less'}`;
}

export const PROOF_WORD: Record<ProofNeed, string> = {
  none: 'None',
  optional: 'Optional',
  required: 'Required',
};

/** The clarifying question on a drafted rule, if the draft has one. */
export const questionFor = (draft: SayRulesDraft, ruleId: string) =>
  draft.questions.find((q) => q.ruleId === ruleId);

/**
 * A rule's answered question: the chosen option's index, or `custom` once its days were set in the
 * editor to something neither option says. A question not answered yet has no entry.
 */
export type Answer = number | 'custom';

/** The four facts on a drafted rule: who, days, how it is answered and the screenshot. */
export function factsOf(
  w: World,
  rule: Rule,
  open: boolean,
): { label: string; value: string; pending?: boolean }[] {
  return [
    { label: 'Who', value: whoWord(w, rule.who) },
    open
      ? { label: 'Days', value: 'Not set yet', pending: true }
      : { label: 'Days', value: formatWeekdays(rule.days) },
    { label: 'Answer', value: answerWord(rule) },
    { label: 'Screenshot', value: PROOF_WORD[rule.proof] },
  ];
}
