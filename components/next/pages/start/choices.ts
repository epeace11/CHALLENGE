import {
  Bookmark,
  BookOpen,
  Dumbbell,
  Flame,
  GlassWater,
  House,
  Link2,
  Moon,
  PiggyBank,
  Smartphone,
  Sparkles,
  Utensils,
  WineOff,
  type LucideIcon,
} from 'lucide-react';
import type { Look, Rule, RuleGroup, World } from '@/lib/next/model';
import { formatWhen, nameOf, plural } from '@/lib/next/selectors';

/**
 * The ways to start that open a sheet first: the four themes and the couple's saved challenges,
 * shaped the same way so every version shows them alike and the sheet takes either.
 */
export type Choice = {
  kind: 'theme' | 'saved';
  id: string;
  name: string;
  look: Look;
  days: number;
  rules: Rule[];
  /** Rules that start switched off and can be added at setup. */
  optionalIds: string[];
  /** One plain line for the sheet: the theme's summary, or where a saved one came from. */
  about: string;
  /** Days and rules, each kept on one line when they wrap: ["30 days", "1 rule + 1 optional"]. */
  facts: string[];
  /** The rule a card shows as a sample. */
  sample: Rule;
  icon: LucideIcon;
  /** Who shared it, for a saved challenge opened from a link. */
  sharedBy: string | null;
  /** A saved challenge this couple already ran, so it has a verdict to open. */
  ran: boolean;
};

const LOOK_ICON: Record<Look, LucideIcon> = {
  classic: Sparkles,
  'seventy-five': Flame,
  sleep: Moon,
  dry: WineOff,
  fitness: Dumbbell,
};

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

/** "5 rules", "1 rule + 1 optional". */
function ruleCount(rules: Rule[], optionalIds: string[]) {
  const optional = rules.filter((r) => optionalIds.includes(r.id)).length;
  const required = rules.length - optional;
  return optional > 0
    ? `${plural(required, 'rule')} + ${optional} optional`
    : plural(rules.length, 'rule');
}

const firstRequired = (rules: Rule[], optionalIds: string[]) =>
  rules.find((r) => !optionalIds.includes(r.id)) ?? rules[0];

/** The four themes, in catalogue order. */
export function themeChoices(w: World): Choice[] {
  return w.themes.map((t) => ({
    kind: 'theme',
    id: t.id,
    name: t.name,
    look: t.look,
    days: t.days,
    rules: t.rules,
    optionalIds: t.optionalRuleIds,
    about: t.summary,
    facts: [plural(t.days, 'day'), ruleCount(t.rules, t.optionalRuleIds)],
    sample: firstRequired(t.rules, t.optionalRuleIds),
    icon: LOOK_ICON[t.look],
    sharedBy: null,
    ran: false,
  }));
}

/** "July": the month a past challenge started, said as a word. */
const MONTH = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  timeZone: 'UTC',
});

/** Saved challenges: the couple's own first, then ones opened from a link. */
export function savedChoices(w: World): Choice[] {
  return [...w.saved]
    .sort((a, b) => (a.source === b.source ? 0 : a.source === 'mine' ? -1 : 1))
    .map((s) => {
      const past = w.past.find((p) => p.challenge.name === s.name)?.challenge;
      return {
        kind: 'saved',
        id: s.id,
        name: s.name,
        look: s.look,
        days: s.days,
        rules: s.rules,
        optionalIds: [],
        about: s.sharedBy
          ? `Shared by ${s.sharedBy}.`
          : past
            ? `You ran it in ${MONTH.format(new Date(`${past.start}T12:00:00Z`))}.`
            : 'Saved by the two of you.',
        facts: [plural(s.days, 'day'), ruleCount(s.rules, [])],
        sample: s.rules[0],
        icon: s.source === 'link' ? Link2 : Bookmark,
        sharedBy: s.sharedBy,
        ran: !!past,
      };
    });
}

/** Keeps "11 pm" and "7 am" on one line when a title wraps. */
export const keepTogether = (title: string) =>
  title.replace(/(\d) (am|pm)\b/g, '$1\u00a0$2');

const UNIT_WORD: Record<string, string> = {
  min: 'minutes',
  h: 'hours',
  L: 'litres',
  kcal: 'calories',
};

/** How a rule is answered, in a few words: "Yes or No", "Number of steps". */
export function answerWord(rule: Rule) {
  if (rule.kind === 'number' && rule.target)
    return `Number of ${UNIT_WORD[rule.target.unit] ?? rule.target.unit}`;
  return 'Yes or No';
}

/**
 * The pieces under a rule's title: who (when it is not both), when it is asked, how it is answered
 * and whether it needs a screenshot. ["Only Jordan", "Every day", "Number of steps", "Screenshot"].
 */
export function ruleDetail(w: World, rule: Rule) {
  const parts: string[] = [];
  if (rule.who !== 'both')
    parts.push(
      rule.who === w.me.id ? 'Only you' : `Only ${nameOf(w, rule.who)}`,
    );
  // A weekly rule's title already says how many days ("Gym, 4 days a week").
  if (rule.kind === 'weekly') parts.push('Yes or No', 'Counted each week');
  else parts.push(formatWhen(rule), answerWord(rule));
  if (rule.personalTarget) parts.push('Each sets their own limit');
  if (rule.proof === 'required') parts.push('Screenshot');
  if (rule.proof === 'optional') parts.push('Screenshot optional');
  return parts;
}
