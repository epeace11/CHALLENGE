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
    text: 'Start from a theme or write your own. You both sign before day one.',
  },
  {
    icon: CircleCheckBig,
    title: 'You each check in every day',
    text: 'Answer each rule for the day before. Some rules ask for a screenshot.',
  },
  {
    icon: UserCheck,
    title: 'Your partner checks your answers',
    text: 'They approve each answer, or dispute one that looks wrong.',
  },
  {
    icon: Gift,
    title: 'Each miss adds to the gift you owe them',
    text: 'Each miss is a point. The first point adds $1, the second $2, and so on. You choose the amount when you set up.',
  },
];

/** "75 days · 6 rules". Rules a couple can switch on later (Dry Month's no weed) are not counted. */
export function themeFacts(theme: Theme) {
  const rules = theme.rules.length - theme.optionalRuleIds.length;
  return `${plural(theme.days, 'day')} · ${plural(rules, 'rule')}`;
}
