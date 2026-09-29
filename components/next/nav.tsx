'use client';
import { createContext, useContext } from 'react';

/** Every page of the new product, in the preview's order. Folder names under components/next/pages/. */
export const PAGE_IDS = [
  'landing',
  'signup',
  'shared',
  'start',
  'say',
  'setup',
  'home',
  'invite',
  'pact',
  'practice',
  'overview',
  'log',
  'rules',
  'review',
  'gifts',
  'progress',
  'recap',
  'verdict',
  'settings',
] as const;

export type PageId = (typeof PAGE_IDS)[number];

export const isPageId = (x: unknown): x is PageId =>
  typeof x === 'string' && (PAGE_IDS as readonly string[]).includes(x);

export type Nav = {
  /** The page on screen; null on the preview's page index. */
  page: PageId | null;
  /** Its version, from 1. */
  version: number;
  /**
   * Opens another page, on the version last chosen for it (or `version`). Pass null for the
   * preview's page index. Frames and pages move between pages only through this.
   */
  navigate: (page: PageId | null, options?: { version?: number }) => void;
};

export const NavContext = createContext<Nav>({
  page: null,
  version: 1,
  navigate: () => {},
});

/** The current page and navigate(), from the preview (or whatever hosts the pages later). */
export const useNav = () => useContext(NavContext);
