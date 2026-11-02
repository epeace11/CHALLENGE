import {
  CircleCheckBig,
  Gift,
  ListChecks,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';
import type { Theme } from '@/lib/next/model';
import { plural } from '@/lib/next/selectors';

/** The landing page's words and facts, shared by both versions. */

/** The four parts of a challenge, in the order they happen. */
export const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: ListChecks,
    title: 'You set the rules together',
    text: 'Pick the rules, then you both sign.',
  },
  {
    icon: CircleCheckBig,
    title: 'You each check in every day',
    text: 'Each day, answer for the day before.',
  },
  {
    icon: UserCheck,
    title: 'Your partner checks your answers',
    text: 'They approve or dispute each one.',
  },
  {
    icon: Gift,
    title: 'Points set the gift you give',
    text: 'Each miss is a point. The first costs $1, the second $2.',
  },
];

/**
 * "30 days · 5 rules", or "30 days · 1 rule + 1 optional" (Dry Month's no weed), as on Start. A
 * name that already says its length ("75-Day Challenge") gets just "6 rules", not 75 twice.
 */
export function themeFacts(theme: Theme) {
  const optional = theme.optionalRuleIds.length;
  const rules = `${plural(theme.rules.length - optional, 'rule')}${optional ? ` + ${optional} optional` : ''}`;
  const named = new RegExp(`\\b${theme.days}[- ]day`, 'i').test(theme.name);
  return named ? rules : `${plural(theme.days, 'day')} · ${rules}`;
}
