import type {
  DateString,
  Look,
  Person,
  Rule,
  SavedChallenge,
  World,
} from '@/lib/next/model';
import {
  LOOKS,
  formatMoney,
  formatTarget,
  formatWhen,
  giftTotal,
  shift,
  weekday,
} from '@/lib/next/selectors';

/** Plain facts about the shared challenge for its page: no React, so both versions share them. */

/** The saved challenge the link opened: Dry October, from Priya & Sam. */
export const sharedChallenge = (w: World): SavedChallenge =>
  w.saved.find((s) => s.source === 'link') ?? w.saved[0];

export type Who = Pick<Person, 'name' | 'initial' | 'hue'>;

/** The two people who shared it, for their avatars ("Priya & Sam"). Null when it is not two names. */
export function sharers(by: string | null): [Who, Who] | null {
  const names = (by ?? '').split(/\s*&\s*|\s+and\s+/).filter(Boolean);
  if (names.length !== 2) return null;
  // A steady hue per name, so the avatars never change colour.
  const hue = (name: string) => {
    let h = 17;
    for (let i = 0; i < name.length; i++)
      h = (h * 31 + name.charCodeAt(i)) % 360;
    return h;
  };
  const [a, b] = names.map((name) => ({
    name,
    initial: name[0].toUpperCase(),
    hue: hue(name),
  }));
  return [a, b];
}

/** A look's name: "Dry". */
export const lookName = (look: Look) =>
  LOOKS.find((l) => l.id === look)?.label ?? 'Classic';

/** "Yes or No", or "A number, 60 min or less". */
export const answerText = (rule: Rule) =>
  rule.kind === 'number' && rule.target
    ? `A number, ${formatTarget(rule.target)}`
    : 'Yes or No';

/** Whether a Yes needs a screenshot. */
export const proofText = (rule: Rule) =>
  rule.proof === 'required'
    ? 'Screenshot required'
    : rule.proof === 'optional'
      ? 'Screenshot optional'
      : 'No screenshot';

/** "Every day · Yes or No · No screenshot": its days, how you answer, and the proof. */
export const ruleFacts = (rule: Rule) =>
  [formatWhen(rule), answerText(rule), proofText(rule)].join(' · ');

/** "$2 + $4 + $6": what the first `n` misses cost one by one. */
export const costSteps = (n: number, step: number) =>
  Array.from({ length: n }, (_, i) => formatMoney((i + 1) * step)).join(' + ');

/** "$2, $4, $6…": how each miss costs one step more than the last. */
export const costSequence = (step: number) =>
  `${[1, 2, 3].map((i) => formatMoney(i * step)).join(', ')}…`;

/** "3 misses cost $2 + $4 + $6 = $12", the one-line example (or where the cap stops it). */
export function costExample(
  s: Pick<SavedChallenge, 'step' | 'cap'>,
  misses = 3,
) {
  const total = giftTotal(misses, s.step, s.cap);
  if (total < giftTotal(misses, s.step))
    return `${misses} misses cost ${formatMoney(total)}, the most a gift can be`;
  return `${misses} misses cost ${costSteps(misses, s.step)} = ${formatMoney(total)}`;
}

/** The Monday after `today`: a sample first day, to show where the dates would land. */
export const nextMonday = (today: DateString) =>
  shift(today, (8 - weekday(today)) % 7 || 7);
