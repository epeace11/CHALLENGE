import type { ComponentType } from 'react';
import type { PageId } from '../nav';
import { PAGE_GROUPS, PAGE_META, type PageGroup, type PageMeta } from './meta';
import { versions as landing } from './landing';
import { versions as signup } from './signup';
import { versions as shared } from './shared';
import { versions as start } from './start';
import { versions as say } from './say';
import { versions as setup } from './setup';
import { versions as home } from './home';
import { versions as invite } from './invite';
import { versions as pact } from './pact';
import { versions as practice } from './practice';
import { versions as overview } from './overview';
import { versions as log } from './log';
import { versions as rules } from './rules';
import { versions as review } from './review';
import { versions as gifts } from './gifts';
import { versions as progress } from './progress';
import { versions as recap } from './recap';
import { versions as verdict } from './verdict';
import { versions as settings } from './settings';

/**
 * Every page of the new product (19 pages, 43 versions): id, title, group, frame, how many versions,
 * and the version components from each folder's index.ts. Workers edit only their own page folder;
 * this file never needs to change.
 */

export type PageEntry = PageMeta & {
  /** Version 1 first. */
  components: ComponentType[];
};

const entry = (id: PageId, components: ComponentType[]): PageEntry => ({
  ...PAGE_META[id],
  components,
});

export const PAGES: PageEntry[] = [
  // First day
  entry('landing', landing),
  entry('signup', signup),
  entry('shared', shared),
  entry('start', start),
  entry('say', say),
  entry('setup', setup),
  entry('home', home),
  entry('invite', invite),
  entry('pact', pact),
  entry('practice', practice),
  // Every day
  entry('overview', overview),
  entry('log', log),
  entry('rules', rules),
  entry('review', review),
  entry('gifts', gifts),
  entry('progress', progress),
  entry('recap', recap),
  // Last day
  entry('verdict', verdict),
  // Settings
  entry('settings', settings),
];

export const pageById = (id: PageId) =>
  PAGES.find((p) => p.id === id) as PageEntry;

export { PAGE_GROUPS, type PageGroup };
