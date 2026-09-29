import type {
  PastChallenge,
  Person,
  Rule,
  SavedChallenge,
  World,
} from '@/lib/next/model';
import {
  formatDate,
  formatMoney,
  formatTarget,
  formatWhen,
  plural,
} from '@/lib/next/selectors';

/** Copies text to the clipboard; false when the browser refuses. */
export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** A link without its https://, for showing. */
export const shortLink = (url: string) => url.replace(/^https?:\/\//, '');

/** "Yours" or "From Priya & Sam". */
export const sourceLine = (s: SavedChallenge) =>
  s.source === 'link' ? `From ${s.sharedBy ?? 'another couple'}` : 'Yours';

/** "21 days, 6 rules" */
export const sizeLine = (s: Pick<SavedChallenge, 'days' | 'rules'>) =>
  `${plural(s.days, 'day')}, ${plural(s.rules.length, 'rule')}`;

/** What Start again says: "Start again" for one of ours, "Start Dry October" for one we have not run. */
export const startLabel = (s: SavedChallenge) =>
  s.source === 'mine' ? 'Start again' : `Start ${s.name}`;

/** "You won, 4 points to 7", "Jordan won, 5 points to 3", "A tie, 4 points each". */
export function verdictLine(w: World, past: PastChallenge) {
  const v = past.verdict,
    mine = v.people.find((p) => p.personId === w.me.id),
    theirs = v.people.find((p) => p.personId !== w.me.id);
  if (!mine || !theirs) return '';
  if (!v.winner) return `A tie, ${plural(mine.points, 'point')} each`;
  return v.winner === w.me.id
    ? `You won, ${plural(mine.points, 'point')} to ${theirs.points}`
    : `${w.partner.name} won, ${plural(theirs.points, 'point')} to ${mine.points}`;
}

/** The saved challenge that runs a past one again, if it was saved (same name, ours). */
export const savedFor = (w: World, past: PastChallenge) =>
  w.saved.find((s) => s.source === 'mine' && s.name === past.challenge.name);

/** "Every day · 10,000 steps or more · Screenshot required", "Any 3 days, Monday to Sunday". */
export function ruleLine(rule: Rule) {
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

/** A saved challenge's rules grouped as Both of you, then each person. Empty groups are left out. */
export function rulesByWho(rules: Rule[], me: Person, partner: Person) {
  return [
    {
      key: 'both',
      title: 'Both of you',
      rules: rules.filter((r) => r.who === 'both'),
    },
    { key: me.id, title: me.name, rules: rules.filter((r) => r.who === me.id) },
    {
      key: partner.id,
      title: partner.name,
      rules: rules.filter((r) => r.who === partner.id),
    },
  ].filter((g) => g.rules.length > 0);
}

/** "First point $1, then $2, $3… · No cap" */
export const stakesLine = (s: Pick<SavedChallenge, 'step' | 'cap'>) =>
  `First point ${formatMoney(s.step)}, then ${formatMoney(s.step * 2)}, ${formatMoney(s.step * 3)}…` +
  (s.cap === null ? ' · No cap' : ` · Capped at ${formatMoney(s.cap)}`);

/** "Saved Jul 27" */
export const savedLine = (s: SavedChallenge) =>
  `Saved ${formatDate(s.savedOn)}`;
