import {
  BookOpen,
  Dumbbell,
  House,
  Moon,
  PiggyBank,
  Smartphone,
  Utensils,
  Wine,
  type LucideIcon,
} from 'lucide-react';
import type {
  DateString,
  Instant,
  Person,
  ProofNeed,
  Rule,
  RuleGroup,
  RuleKind,
  Weekday,
  World,
} from '@/lib/next/model';
import {
  formatDayShort,
  formatNumber,
  formatTarget,
  formatWeekdays,
  formatWhen,
  lastDay,
  nameOf,
  shift,
  weekday,
} from '@/lib/next/selectors';

/** Plain facts about rules and rule-change proposals, for both versions of Rules and help. */

export const GROUP_ICON: Record<RuleGroup, LucideIcon> = {
  Sleep: Moon,
  Screens: Smartphone,
  Food: Utensils,
  Drinks: Wine,
  Movement: Dumbbell,
  Mind: BookOpen,
  Money: PiggyBank,
  Home: House,
};

export const whoLabel = (world: World, who: string) =>
  who === 'both' ? 'Both of you' : nameOf(world, who);

/** "Every day", "Sun–Thu", "4 days a week". */
export const whenLabel = (rule: Rule) => formatWhen(rule);

/** How it is answered: "Yes or No", "A number: 60 min or less". */
export function answerLabel(rule: Rule) {
  if (rule.kind === 'number' && rule.target)
    return `A number: ${formatTarget(rule.target)}`;
  if (rule.kind === 'weekly') return 'Yes or No each day';
  return 'Yes or No';
}

/** "Screenshot required", "Screenshot optional", or null for none. */
export function proofLabel(rule: Pick<Rule, 'proof'>) {
  if (rule.proof === 'required') return 'Screenshot required';
  if (rule.proof === 'optional') return 'Screenshot optional';
  return null;
}

/** The rules as couples think of them: shared ones, then each person's own. Retired ones are left out. */
export function rulesByWho(world: World) {
  const today = world.today;
  const live = world.challenge.rules.filter(
    (r) => !r.endsOn || r.endsOn >= today,
  );
  const groups: {
    key: string;
    title: string;
    people: Person[];
    rules: Rule[];
  }[] = [
    {
      key: 'both',
      title: 'Both of you',
      people: [world.me, world.partner],
      rules: live.filter((r) => r.who === 'both'),
    },
    {
      key: world.me.id,
      title: world.me.name,
      people: [world.me],
      rules: live.filter((r) => r.who === world.me.id),
    },
    {
      key: world.partner.id,
      title: world.partner.name,
      people: [world.partner],
      rules: live.filter((r) => r.who === world.partner.id),
    },
  ];
  return groups.filter((g) => g.rules.length > 0);
}

/* ── Proposals ────────────────────────────────────────────────────────── */

export type ProposalKind = 'add' | 'change' | 'retire';

/** A rule as the proposal form edits it. */
export type RuleDraft = {
  title: string;
  who: string;
  kind: RuleKind;
  days: Weekday[];
  perWeek: number;
  target: number | null;
  op: '>=' | '<=';
  unit: string;
  proof: ProofNeed;
};

export type Proposal = {
  id: string;
  kind: ProposalKind;
  /** The rule changed or retired. */
  ruleId?: string;
  /** The new rule (add) or how it would read (change). */
  draft?: RuleDraft;
  /** When it takes effect; a retired rule stops counting that day. */
  from: DateString;
  note: string;
  sentAt: Instant;
};

export const EVERY_DAY: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

export const blankDraft = (): RuleDraft => ({
  title: '',
  who: 'both',
  kind: 'yesno',
  days: EVERY_DAY,
  perWeek: 3,
  target: null,
  op: '>=',
  unit: '',
  proof: 'none',
});

export const draftOfRule = (rule: Rule): RuleDraft => ({
  title: rule.title,
  who: rule.who,
  kind: rule.kind,
  days: rule.days,
  perWeek: rule.weeklyTarget ?? 3,
  target: rule.target?.value ?? null,
  op: rule.target?.op ?? '>=',
  unit: rule.target?.unit ?? '',
  proof: rule.proof,
});

/** "0,1,2,3,4" for Sun–Thu, whatever order the days came in. */
export const daysKeyOf = (days: Weekday[]) =>
  [...days].sort((x, y) => x - y).join();
const sameDays = (a: Weekday[], b: Weekday[]) => daysKeyOf(a) === daysKeyOf(b);

/** What a change would change, in a few words each: "45 min or less", "Sun–Thu", "Screenshot required". */
export function changesOf(world: World, rule: Rule, d: RuleDraft): string[] {
  const out: string[] = [];
  const before = draftOfRule(rule);
  if (d.title.trim() !== rule.title) out.push(`Called “${d.title.trim()}”`);
  if (d.who !== before.who)
    out.push(
      d.who === 'both' ? 'For both of you' : `Just ${nameOf(world, d.who)}`,
    );
  if (d.kind !== before.kind) out.push(kindLabel(d.kind));
  if (d.kind === 'number') {
    if (
      d.target !== before.target ||
      d.op !== before.op ||
      d.unit.trim() !== before.unit
    )
      out.push(draftTarget(d));
  } else if (d.kind === 'weekly') {
    if (d.perWeek !== before.perWeek || before.kind !== 'weekly')
      out.push(`${d.perWeek} days a week`);
  }
  if (d.kind !== 'weekly' && !sameDays(d.days, before.days))
    out.push(formatWeekdays(d.days));
  if (d.proof !== before.proof) out.push(proofLabel(d) ?? 'No screenshot');
  return out;
}

export const kindLabel = (k: RuleKind) =>
  k === 'number' ? 'A number' : k === 'weekly' ? 'Days a week' : 'Yes or No';

/** "45 min or less". */
export const draftTarget = (d: RuleDraft) =>
  d.target === null
    ? 'No target yet'
    : `${formatNumber(d.target)} ${d.unit.trim()} ${d.op === '<=' ? 'or less' : 'or more'}`;

/** A short description of a drafted rule: "Both of you · Sun–Thu · Yes or No". */
export function draftSummary(world: World, d: RuleDraft) {
  const when =
    d.kind === 'weekly' ? `${d.perWeek} days a week` : formatWeekdays(d.days);
  const answer = d.kind === 'number' ? draftTarget(d) : 'Yes or No';
  return [whoLabel(world, d.who), when, answer, proofLabel(d)]
    .filter(Boolean)
    .join(' · ');
}

/** The proposal as a title and one line, for the card that waits for the partner. */
export function describe(world: World, p: Proposal) {
  const rule = p.ruleId
    ? world.challenge.rules.find((r) => r.id === p.ruleId)
    : undefined;
  const from = formatDayShort(p.from);
  if (p.kind === 'add' && p.draft)
    return {
      title: `Add “${p.draft.title.trim()}”`,
      detail: `${draftSummary(world, p.draft)} · from ${from}`,
    };
  if (p.kind === 'change' && rule && p.draft)
    return {
      title: `Change “${rule.title}”`,
      detail: `${changesOf(world, rule, p.draft).join(' · ')} · from ${from}`,
    };
  return {
    title: `Retire “${rule?.title ?? 'a rule'}”`,
    detail: `Stops counting from ${from}`,
  };
}

/** Start dates to offer: tomorrow, the next week's first day, and the challenge's last day as the limit. */
export function startOptions(world: World) {
  const c = world.challenge,
    tomorrow = shift(world.today, 1),
    last = lastDay(c);
  let monday = shift(tomorrow, 1);
  while (weekday(monday) !== c.weekStart) monday = shift(monday, 1);
  return {
    tomorrow,
    nextWeek: monday <= last ? monday : null,
    first: tomorrow,
    last,
  };
}

/** Rules from the library this challenge does not have yet, one per group: ideas for "Add a rule". */
export function ideas(world: World, count = 6) {
  const have = new Set(world.challenge.rules.map((r) => r.title));
  const seen = new Set<RuleGroup>();
  const out: Rule[] = [];
  for (const r of world.library) {
    if (have.has(r.title) || seen.has(r.group)) continue;
    seen.add(r.group);
    out.push(r);
    if (out.length >= count) break;
  }
  return out;
}
