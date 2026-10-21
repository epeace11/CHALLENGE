import type { Rule } from '@/lib/next/model';
import { formatDeadline, formatMoney } from '@/lib/next/selectors';
import { draftCap, draftDays, rangeLine, zoneCity, type Draft } from './draft';

/** Each part of the draft in plain words, for the checklist rows that sum it up. */

/** "Fall Reset · Mon, Nov 2 – Tue, Dec 1" */
export const detailsLine = (d: Draft) =>
  [d.name.trim() || 'No name yet', rangeLine(d.start, draftDays(d))].join(
    ' · ',
  );

/** "No alcohol, Gym and 5 more" */
export function rulesLine(rules: Rule[]) {
  const titles = rules.map((r) => r.title);
  if (titles.length === 0) return 'No rules yet';
  if (titles.length === 1) return titles[0];
  if (titles.length <= 3)
    return `${titles.slice(0, -1).join(', ')} and ${titles[titles.length - 1]}`;
  return `${titles.slice(0, 2).join(', ')} and ${titles.length - 2} more`;
}

/** "First point $1 · No cap" */
export function stakesLine(d: Draft) {
  const cap = draftCap(d);
  return `First point ${formatMoney(d.step)} · ${cap === null ? 'No cap' : `Gifts capped at ${formatMoney(cap)}`}`;
}

/** "Log by 11:59 pm the next day" */
const deadlineShort = (d: Draft) => `Log by ${formatDeadline(d.deadline)}`;

/** "Log by 11:59 pm the next day · Toronto" */
export const deadlineZoneLine = (d: Draft) =>
  `${deadlineShort(d)} · ${zoneCity(d.timeZone)}`;
