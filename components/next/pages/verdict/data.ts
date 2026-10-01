import {
  CalendarCheck,
  Dumbbell,
  Flame,
  Heart,
  Rocket,
  ShieldCheck,
  Sparkles,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import type {
  Person,
  PastChallenge,
  SavedChallenge,
  World,
} from '@/lib/next/model';
import {
  appliesOn,
  badges,
  challengeDays,
  formatMoney,
  formatRange,
  giftTotal,
  lastDay,
  personById,
  ruleById,
} from '@/lib/next/selectors';

/**
 * The verdict of a finished challenge, as both versions show it: who won, the two gifts (each set by
 * the giver's points), best streaks and badges. Pure functions of the world.
 */

/** A badge's icon, by badge id. */
export const BADGE_ICON: Record<string, LucideIcon> = {
  'first-clean-day': Sparkles,
  'clean-week': CalendarCheck,
  'streak-7': Flame,
  'streak-14': Flame,
  'streak-all': ShieldCheck,
  'full-week': Dumbbell,
  'week-won': Trophy,
  gracious: Heart,
  'strong-finish': Rocket,
};

export type VerdictSide = {
  person: Person;
  isMe: boolean;
  points: number;
  forgiven: number;
  /** The gift this person receives, set by the partner's points. */
  gets: number;
  owes: number;
  streak: { title: string; description: string; days: number; all: boolean };
  badges: { id: string; title: string; how: string }[];
};

export function verdictOf(
  w: World,
  past: PastChallenge | undefined = w.past[0],
) {
  if (!past) return null;
  const c = past.challenge,
    v = past.verdict;
  // Titles and how-to for every badge id (the same set every challenge uses).
  const known = new Map(badges(w, w.me.id).map((b) => [b.id, b]));
  const side = (personId: string): VerdictSide | null => {
    const p = v.people.find((x) => x.personId === personId),
      person = personById(w, personId);
    if (!p || !person) return null;
    const rule = ruleById(c, p.bestStreak.ruleId);
    const daysAsked = rule
      ? challengeDays(c).filter((d) => appliesOn(rule, d, c)).length
      : 0;
    return {
      person,
      isMe: personId === w.me.id,
      points: p.points,
      forgiven: p.forgiven,
      gets: p.gets,
      owes: p.owes,
      streak: {
        title: rule?.title ?? 'A habit',
        description: rule?.description ?? '',
        days: p.bestStreak.days,
        all: !!rule && p.bestStreak.days >= daysAsked,
      },
      badges: p.badges.map((id) => ({
        id,
        title: known.get(id)?.title ?? id,
        how: known.get(id)?.how ?? '',
      })),
    };
  };
  const me = side(w.me.id),
    partner = side(w.partner.id);
  if (!me || !partner) return null;
  return {
    past,
    name: c.name,
    range: formatRange(c.start, lastDay(c)),
    step: c.step,
    cap: c.cap,
    me,
    partner,
    winner: v.winner,
  };
}

export type VerdictView = NonNullable<ReturnType<typeof verdictOf>>;

/** The two gifts, the viewer's first: who gets it, who gives it, and how much. */
export function giftsOf(v: VerdictView) {
  return [
    { id: v.me.person.id, to: v.me, from: v.partner, amount: v.me.gets },
    {
      id: v.partner.person.id,
      to: v.partner,
      from: v.me,
      amount: v.partner.gets,
    },
  ];
}

export type Gift = ReturnType<typeof giftsOf>[number];

/** "$1 + $2 + $3 + $4 = $10": how a gift adds up from the giver's points. */
export function giftSum(points: number, step: number, cap: number | null) {
  const total = giftTotal(points, step, cap);
  if (points === 0) return formatMoney(0);
  const parts = Array.from({ length: points }, (_, i) =>
    formatMoney((i + 1) * step),
  );
  const shown =
    parts.length > 8 ? [...parts.slice(0, 3), '…', ...parts.slice(-2)] : parts;
  const capped = cap !== null && total >= cap;
  return `${shown.join(' + ')} = ${formatMoney(total)}${capped ? ' (the cap)' : ''}`;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'challenge';

/** A name nobody has used for a saved challenge yet: "Summer Sprint 2". */
export function suggestName(w: World, base: string) {
  const taken = new Set(w.saved.map((s) => s.name.toLowerCase()));
  let n = 2;
  while (taken.has(`${base} ${n}`.toLowerCase()) && n < 99) n++;
  return `${base} ${n}`;
}

/** Keeps a finished challenge to run again later, under a new name. */
export function saveAs(w: World, past: PastChallenge, name: string): World {
  const c = past.challenge;
  let id = `saved-${slug(name)}`;
  for (let n = 2; w.saved.some((s) => s.id === id); n++)
    id = `saved-${slug(name)}-${n}`;
  const saved: SavedChallenge = {
    id,
    name: name.trim(),
    look: c.look,
    days: c.days,
    step: c.step,
    cap: c.cap,
    rules: c.rules,
    source: 'mine',
    sharedBy: null,
    link: `https://thechallenge.win/c/${id.replace(/^saved-/, '')}`,
    linkOn: false,
    savedOn: w.today,
  };
  return { ...w, saved: [...w.saved, saved] };
}
