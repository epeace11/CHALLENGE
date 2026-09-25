import { dayOfWeek } from './dates.ts';
import { targetFor, weekOf, type Week } from './weeks.ts';

export type Person = 'Erin' | 'Kazzy';

/**
 * One habit. The same ids live in the database (challenge_rules), which does the scoring;
 * this list drives what the app shows and asks.
 */
export type Rule = {
  id: string;
  /** Short name used in lists. */
  title: string;
  /** Longer name for the Rules page and habit view, when the short one leaves something out. */
  fullTitle?: string;
  /** Asked on the Log page. */
  question: string;
  description: string;
  /** Which days it applies: 'Sun–Thu', 'Fri–Sat', 'Every day' or 'Weekly'. */
  days: string;
  group: string;
  /** Only this person has the rule; otherwise both do. */
  person?: Person;
  /** A Yes needs at least one screenshot. */
  proof?: boolean;
  /** Counted per Monday–Sunday week against the week's target, like the gym. */
  weekly?: boolean;
};

export const rules: Rule[] = [
  {
    id: 'bed',
    title: 'In bed by 11 pm, then read',
    fullTitle: 'In bed by 11 pm, then read until you sleep',
    question: 'Were you in bed by 11 pm, reading until you fell asleep?',
    description: 'Be in bed by 11 pm and read until you fall asleep.',
    days: 'Sun–Thu',
    group: 'Sleep',
  },
  {
    id: 'bed_1am',
    title: 'In bed by 1 am, then read',
    fullTitle: 'Weekends: in bed by 1 am, then read until you sleep',
    question: 'Were you in bed by 1 am, reading until you fell asleep?',
    description:
      'Fridays and Saturdays: be in bed by 1 am and read until you fall asleep.',
    days: 'Fri–Sat',
    group: 'Sleep',
    person: 'Kazzy',
  },
  {
    id: 'screens',
    title: 'No screens in the bedroom',
    question: 'Did you keep screens out of the bedroom?',
    description:
      'No screens of any kind in the bedroom. Phones stay outside the room.',
    days: 'Sun–Thu',
    group: 'Sleep',
  },
  {
    id: 'weed',
    title: 'No smoking weed',
    question: 'Did you avoid smoking weed?',
    description: 'No smoking weed on Sunday through Thursday.',
    days: 'Sun–Thu',
    group: 'Habits',
    person: 'Erin',
  },
  {
    id: 'weed_daily',
    title: 'No smoking weed, all week',
    question: 'Did you avoid smoking weed?',
    description: 'No smoking weed on any day, weekends included.',
    days: 'Every day',
    group: 'Habits',
    person: 'Kazzy',
  },
  {
    id: 'prayer',
    title: 'Pray daily',
    question: 'Did you pray today?',
    description: 'At least once, every day.',
    days: 'Every day',
    group: 'Habits',
  },
  {
    id: 'food',
    title: 'No eating out',
    question: 'Did you avoid eating out?',
    description: 'Takeout and delivery count. Coffee is allowed.',
    days: 'Every day',
    group: 'Food',
  },
  {
    id: 'time',
    title: 'Screen time: 1 hour or less',
    question: 'Was your useless screen time an hour or less?',
    description:
      'Social media and games count. YouTube is excluded. Attach your Screen Time screenshots.',
    days: 'Every day',
    group: 'Focus',
    proof: true,
  },
  {
    id: 'entertainment',
    title: 'No entertainment before 6 pm',
    question: 'Did you avoid entertainment before 6 pm?',
    description:
      'Content before 6 pm must be educational and related to work, including YouTube.',
    days: 'Every day',
    group: 'Focus',
  },
  {
    id: 'steps',
    title: '10,000 steps',
    question: 'Did you walk at least 10,000 steps?',
    description: 'Reach 10,000 steps and attach a step-count screenshot.',
    days: 'Every day',
    group: 'Movement',
    person: 'Erin',
    proof: true,
  },
  {
    id: 'calories',
    title: '2,300 calories or less',
    fullTitle: '2,300 calories or less + macros tracked',
    question: 'Did you stay within 2,300 calories and track your macros?',
    description: 'Both are required. Attach your ChatGPT macro screenshot.',
    days: 'Every day',
    group: 'Food',
    person: 'Kazzy',
    proof: true,
  },
  {
    id: 'gym',
    title: 'Go to gym',
    question: 'Did you go to the gym today?',
    description:
      'Condo or regular gym. One visit per day. Weeks run Monday to Sunday. Four visits per full week; the first week (Sep 15–20) needs three and the last (Oct 12–14) needs one.',
    days: 'Weekly',
    group: 'Movement',
    weekly: true,
  },
  {
    id: 'steps_weekly',
    title: '10,000 steps, 3 days a week',
    question: 'Did you walk at least 10,000 steps today?',
    description:
      'Reach 10,000 steps on three days each Monday–Sunday week and attach a step-count screenshot. Sep 21–27 needs one day, and so does the final Oct 12–14.',
    days: 'Weekly',
    group: 'Movement',
    person: 'Kazzy',
    proof: true,
    weekly: true,
  },
];

/** Short label for a weekly rule in the weekly-targets list. */
export const weeklyLabel: Record<string, string> = {
  gym: 'Gym',
  steps_weekly: 'Steps (Kazzy)',
};

export const ruleById = (id: string) => rules.find((r) => r.id === id);
export const titleFor = (id: string) => ruleById(id)?.title ?? id;
/** Position in the rule list, for sorting. */
export const ruleIndex = (id: string) => rules.findIndex((r) => r.id === id);
export const weeklyRuleIds = rules.filter((r) => r.weekly).map((r) => r.id);

/** Rules that apply to `person` on `date`. A weekly rule applies only in weeks where it has a target, so pass the loaded weeks; without them weekly rules are left out. */
export function activeRules(person: Person, date: string, weeks: Week[] = []) {
  const dow = dayOfWeek(date);
  return rules.filter(
    (r) =>
      (!r.person || r.person === person) &&
      (r.days !== 'Sun–Thu' || dow <= 4) &&
      (r.days !== 'Fri–Sat' || dow > 4) &&
      (!r.weekly || targetFor(weekOf(weeks, date), r.id) > 0),
  );
}

/** Daily (non-weekly) rules for `person` on `day`. */
export const dailyRules = (person: Person, day: string) =>
  activeRules(person, day).filter((r) => !r.weekly);

/** Weekly rules `person` has at all. */
export const weeklyRules = (person: Person) =>
  rules.filter((r) => r.weekly && (!r.person || r.person === person));
