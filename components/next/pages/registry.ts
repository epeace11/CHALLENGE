import {
  createElement,
  lazy,
  Suspense,
  useEffect,
  useState,
  type ComponentType,
} from 'react';
import type { PageId } from '../nav';
import { PAGE_GROUPS, PAGE_META, type PageGroup, type PageMeta } from './meta';

type Folder = { versions: ComponentType[] };

/**
 * Each page folder, loaded the first time its page is shown, so the app's first load carries only
 * the page it opens on. `preloadPages` fetches the rest once that page is up.
 */
const LOAD: Record<PageId, () => Promise<Folder>> = {
  landing: () => import('./landing'),
  signup: () => import('./signup'),
  shared: () => import('./shared'),
  start: () => import('./start'),
  say: () => import('./say'),
  setup: () => import('./setup'),
  home: () => import('./home'),
  invite: () => import('./invite'),
  pact: () => import('./pact'),
  practice: () => import('./practice'),
  overview: () => import('./overview'),
  log: () => import('./log'),
  rules: () => import('./rules'),
  review: () => import('./review'),
  gifts: () => import('./gifts'),
  progress: () => import('./progress'),
  recap: () => import('./recap'),
  verdict: () => import('./verdict'),
  settings: () => import('./settings'),
};

type Version = ComponentType & {
  preload: () => Promise<unknown>;
  /** Its code has arrived: it renders at once. */
  ready: () => boolean;
};

/** While a page's code arrives: nothing for 300 ms (a quick load shows no flash), then a spinner. */
function Arriving() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const later = setTimeout(() => setSlow(true), 300);
    return () => clearTimeout(later);
  }, []);
  if (!slow) return null;
  return createElement(
    'div',
    {
      role: 'status',
      className: 'grid min-h-[50dvh] place-items-center text-nx-ink-2',
    },
    createElement('span', { className: 'nx-spinner', 'aria-hidden': true }),
    createElement('span', { className: 'sr-only' }, 'Loading'),
  );
}

/**
 * One version of a page, from its folder. The first time it shows before its code has arrived, it
 * shows `Arriving` until it does; once loaded (or preloaded) it renders at once, with no empty
 * frame. If the code fails to arrive, the error reaches the host's error boundary, and the next
 * mount (its Try again) fetches it afresh.
 */
function lazyVersion(load: () => Promise<Folder>, index: number): Version {
  let loaded: ComponentType | undefined;
  const preload = () =>
    load().then((folder) => (loaded = folder.versions[index]));
  const fresh = (): ComponentType =>
    lazy(() =>
      preload().then(
        (C) => ({ default: C }),
        (error: unknown) => {
          // React.lazy keeps a failure for good; the next mount gets a new one.
          Lazy = fresh();
          throw error;
        },
      ),
    );
  let Lazy = fresh();
  function PageVersion() {
    // Chosen once, so a page shown before its code arrived doesn't remount when it does.
    const [Shown] = useState<ComponentType>(() => loaded ?? Lazy);
    return createElement(
      Suspense,
      { fallback: createElement(Arriving) },
      createElement(Shown),
    );
  }
  return Object.assign(PageVersion, { preload, ready: () => !!loaded });
}

export type PageEntry = PageMeta & {
  /** Version 1 first. */
  components: Version[];
};

const entry = (id: PageId): PageEntry => ({
  ...PAGE_META[id],
  components: Array.from({ length: PAGE_META[id].versions }, (_, i) =>
    lazyVersion(LOAD[id], i),
  ),
});

/**
 * Every page of the new product (19 pages, one picked version each), in the preview's order. Workers
 * edit only their own page folder; this file never needs to change.
 */
export const PAGES: PageEntry[] = [
  // First day
  entry('landing'),
  entry('signup'),
  entry('shared'),
  entry('start'),
  entry('say'),
  entry('setup'),
  entry('home'),
  entry('invite'),
  entry('pact'),
  entry('practice'),
  // Every day
  entry('overview'),
  entry('log'),
  entry('rules'),
  entry('review'),
  entry('gifts'),
  entry('progress'),
  entry('recap'),
  // Last day
  entry('verdict'),
  // Settings
  entry('settings'),
];

export const pageById = (id: PageId) =>
  PAGES.find((p) => p.id === id) as PageEntry;

/** Fetches every page's code, so moving between pages never waits. Call once the first page is up. */
export function preloadPages() {
  for (const page of PAGES)
    for (const version of page.components)
      void version.preload().catch(() => {});
}

export { PAGE_GROUPS, type PageGroup };
