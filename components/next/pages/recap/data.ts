import type { Rule, World } from '@/lib/next/model';
import {
  formatMoney,
  formatRange,
  formatWeekday,
  gets,
  lastRecap,
  openCheckins,
  openDay,
  plural,
  ruleById,
  rulesFor,
  streaks,
  weekProgress,
} from '@/lib/next/selectors';

/**
 * The Monday recap as both versions show it: last week for the viewer and the partner, the gifts
 * as they stand now, and what this week needs. Pure functions of the world.
 */

/** "Gym" from "Gym, 4 days a week". */
export const shortTitle = (rule: Rule) => rule.title.split(',')[0];

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function recapOf(w: World) {
  const recap = lastRecap(w);
  if (!recap) return null;
  const c = w.challenge;
  const mine = recap.people.find((p) => p.personId === w.me.id);
  const theirs = recap.people.find((p) => p.personId === w.partner.id);
  if (!mine || !theirs) return null;

  const weekly = mine.weekly.flatMap((m) => {
    const rule = ruleById(c, m.ruleId);
    const t = theirs.weekly.find((x) => x.ruleId === m.ruleId);
    return rule ? [{ rule, me: m, partner: t ?? null }] : [];
  });

  // This week: every weekly rule, for both.
  const thisWeek = rulesFor(c, w.me.id)
    .filter((r) => r.kind === 'weekly')
    .flatMap((rule) => {
      const me = weekProgress(w, w.me.id, rule.id),
        partner = weekProgress(w, w.partner.id, rule.id);
      return me ? [{ rule, me, partner }] : [];
    });

  const streak = (p: typeof mine, personId: string) => {
    if (!p.bestStreak) return null;
    const rule = ruleById(c, p.bestStreak.ruleId);
    if (!rule) return null;
    const now =
      streaks(w, personId).find((s) => s.rule.id === rule.id)?.current ?? 0;
    return {
      rule,
      days: p.bestStreak.days,
      /** Still going today, and how long it is now. */
      now: now >= p.bestStreak.days ? now : null,
    };
  };

  return {
    recap,
    range: formatRange(recap.weekStart, recap.weekEnd),
    winner: recap.winner,
    mine,
    theirs,
    gifts: { me: gets(w, w.me.id), partner: gets(w, w.partner.id) },
    weekly,
    thisWeek,
    streaks: {
      me: streak(mine, w.me.id),
      partner: streak(theirs, w.partner.id),
    },
  };
}

export type RecapView = NonNullable<ReturnType<typeof recapOf>>;

/** "You won last week", "Jordan won last week" or "Last week was a tie". */
export function headline(w: World, v: RecapView) {
  if (v.winner === w.me.id) return 'You won last week';
  if (v.winner === w.partner.id) return `${w.partner.name} won last week`;
  return 'Last week was a tie';
}

/** How the Monday notification reads: its title and one short paragraph. */
export function notification(w: World, v: RecapView) {
  const title = `${w.challenge.name}: ${lower(headline(w, v))}`;
  const needs = v.thisWeek.map(({ rule, me, partner }) =>
    partner && partner.need === me.need
      ? `${lower(shortTitle(rule))} ${me.need} times each`
      : `${lower(shortTitle(rule))} ${me.need} times for you`,
  );
  const body = [
    `You ${plural(v.mine.points, 'point')}, ${w.partner.name} ${v.theirs.points}.`,
    `You get a ${formatMoney(v.gifts.me)} gift, ${w.partner.name} ${formatMoney(v.gifts.partner)}.`,
    needs.length ? `This week: ${needs.join(', ')}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
  return { title, body };
}

/** The recap's main action: log the open day while check-ins are left, otherwise see this week. */
export function recapAction(w: World) {
  const day = openDay(w);
  if (day && openCheckins(w, w.me.id).length > 0)
    return { label: `Log ${formatWeekday(day)}`, page: 'log' as const };
  return { label: 'See this week', page: 'progress' as const };
}
