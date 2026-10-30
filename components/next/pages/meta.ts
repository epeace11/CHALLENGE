import type { PageId } from '../nav';

/** Page facts without components, so anything can import them without importing every page. */

export type PageGroup = 'First day' | 'Every day' | 'Last day' | 'Settings';

export const PAGE_GROUPS: PageGroup[] = [
  'First day',
  'Every day',
  'Last day',
  'Settings',
];

export type PageMeta = {
  id: PageId;
  title: string;
  group: PageGroup;
  /** AppFrame inside a running challenge, PlainFrame before or outside one. */
  frame: 'app' | 'plain';
  /** How many versions the page has (its folder's v1.tsx, v2.tsx, v3.tsx): 1 once a version is picked. */
  versions: 1 | 2 | 3;
  /** What the page is for, in one sentence. */
  brief: string;
};

export const PAGE_META: Record<PageId, PageMeta> = {
  landing: {
    id: 'landing',
    title: 'Landing page',
    group: 'First day',
    frame: 'plain',
    versions: 1,
    brief:
      'What The Challenge is and how it works, for a couple deciding to try it. Main action: sign up.',
  },
  signup: {
    id: 'signup',
    title: 'Sign up and sign in',
    group: 'First day',
    frame: 'plain',
    versions: 1,
    brief:
      'Create an account or sign in. Couples only: two people per challenge.',
  },
  shared: {
    id: 'shared',
    title: 'Shared challenge link',
    group: 'First day',
    frame: 'plain',
    versions: 1,
    brief:
      'Opened from a link another couple shared (Dry October from Priya & Sam): its rules and stakes, and start it.',
  },
  start: {
    id: 'start',
    title: 'Start a challenge',
    group: 'First day',
    frame: 'plain',
    versions: 1,
    brief:
      'Choose how to start: create a new challenge, say the rules out loud, a saved challenge, or a theme.',
  },
  say: {
    id: 'say',
    title: 'Say your rules',
    group: 'First day',
    frame: 'plain',
    versions: 1,
    brief:
      'Say or type the rules in one sentence, check the drafted rules, answer the one question, and use them.',
  },
  setup: {
    id: 'setup',
    title: 'Set up and rules',
    group: 'First day',
    frame: 'plain',
    versions: 1,
    brief:
      'Name, dates, rules (from the library), who each is for, screenshots, the step and cap, with the stakes preview.',
  },
  home: {
    id: 'home',
    title: 'Your challenges',
    group: 'First day',
    frame: 'app',
    versions: 1,
    brief:
      'The running challenge, saved ones (share link on or off), past ones with their verdicts, and starting a new one.',
  },
  invite: {
    id: 'invite',
    title: 'Invite',
    group: 'First day',
    frame: 'plain',
    versions: 1,
    brief:
      'Invite the partner with a link or code, and what Jordan sees when he opens “Maya invited you to Fall Reset”.',
  },
  pact: {
    id: 'pact',
    title: 'Sign the pact',
    group: 'First day',
    frame: 'plain',
    versions: 1,
    brief:
      'Both sign before day one: the rules, the deadline and the stakes. Maya has signed; Jordan has not.',
  },
  practice: {
    id: 'practice',
    title: 'Practice day',
    group: 'First day',
    frame: 'plain',
    versions: 1,
    brief:
      'A pretend day: answer three sample questions, see a pretend review (one approved, one disputed) and what a miss costs.',
  },
  overview: {
    id: 'overview',
    title: 'Overview',
    group: 'Every day',
    frame: 'app',
    versions: 1,
    brief:
      'Today at a glance: what is left to log, what waits for review, who is ahead, the gift, gym this week, a streak to protect.',
  },
  log: {
    id: 'log',
    title: 'Check in',
    group: 'Every day',
    frame: 'app',
    versions: 1,
    brief:
      'Check in for Thursday: one check-in at a time (Yes or No, numbers, screenshots, a note), one Save each, gliding to the next.',
  },
  rules: {
    id: 'rules',
    title: 'Rules and help',
    group: 'Every day',
    frame: 'app',
    versions: 1,
    brief:
      'This challenge’s rules, and how deadlines, reviews, disputes, forgiveness, points and gifts work.',
  },
  review: {
    id: 'review',
    title: 'Review',
    group: 'Every day',
    frame: 'app',
    versions: 1,
    brief:
      'Jordan’s answers to approve or dispute, his forgiveness request, and the dispute on Maya’s answer.',
  },
  gifts: {
    id: 'gifts',
    title: 'Gifts',
    group: 'Every day',
    frame: 'app',
    versions: 1,
    brief:
      'What each gift is at and why: each point’s cost (the nth costs n times the step), forgiven points, the next miss.',
  },
  progress: {
    id: 'progress',
    title: 'Progress',
    group: 'Every day',
    frame: 'app',
    versions: 1,
    brief:
      'The calendar, streaks per rule, weekly targets, and badges earned and next.',
  },
  recap: {
    id: 'recap',
    title: 'Monday recap',
    group: 'Every day',
    frame: 'app',
    versions: 1,
    brief:
      'Last week (Nov 9–15) told on Monday: points, who won the week, the gym, streaks.',
  },
  verdict: {
    id: 'verdict',
    title: 'The verdict',
    group: 'Last day',
    frame: 'plain',
    versions: 1,
    brief:
      'How it ended (Summer Sprint): who won, the gift each buys, best streaks and badges; then run it again or start another.',
  },
  settings: {
    id: 'settings',
    title: 'Settings',
    group: 'Settings',
    frame: 'app',
    versions: 1,
    brief:
      'The challenge’s name, look, step, cap and deadline, reminders, the account and the partner, and ending the challenge.',
  },
};
