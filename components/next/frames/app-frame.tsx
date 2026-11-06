'use client';
import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import {
  BookOpen,
  CalendarCheck,
  ChartNoAxesColumn,
  ChevronRight,
  ChevronsUpDown,
  CircleCheckBig,
  Ellipsis,
  Gift,
  House,
  Inbox,
  LayoutGrid,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import {
  dayNumber,
  formatDayShort,
  reviewQueue,
  settling,
} from '@/lib/next/selectors';
import { useNav, type PageId } from '@/components/next/nav';
import { useWorld } from '@/components/next/world';
import { Menu } from '@/components/next/ui/menu';
import { useArrivalFocus } from './use-arrival-focus';
import { useFit } from './use-fit';

const TABS: { id: PageId; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Overview', icon: House },
  { id: 'log', label: 'Check in', icon: CircleCheckBig },
  { id: 'review', label: 'Review', icon: Inbox },
  { id: 'progress', label: 'Progress', icon: ChartNoAxesColumn },
];

/** Reached from More. */
export const MORE_PAGES: { id: PageId; label: string; icon: LucideIcon }[] = [
  { id: 'gifts', label: 'Gifts', icon: Gift },
  { id: 'rules', label: 'Rules and help', icon: BookOpen },
  { id: 'recap', label: 'Monday recap', icon: CalendarCheck },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'home', label: 'Your challenges', icon: LayoutGrid },
];

/**
 * The frame for pages inside a running challenge: the challenge's name and day at the top (the day
 * opens Progress), and the navigation: Overview, Check in, Review (with a count when something
 * waits) and Progress, plus More for Gifts, Rules and help, Monday recap, Settings and Your
 * challenges. A tab bar at the bottom on phones, tabs in the top bar from 1024px.
 *
 * Every page, in both frames, is the same width (720px) with the same side margins.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  const fit = useFit<HTMLDivElement>();
  const header = useRef<HTMLElement>(null);
  const tabbar = useRef<HTMLElement>(null);
  useChromeHeights(header, tabbar);
  const main = useArrivalFocus();
  const world = useWorld();
  const { page, navigate } = useNav();
  const c = world.challenge;
  const queue = reviewQueue(world, world.me.id);
  const over = settling(world);
  // After the last day every open dispute holds up the result, whoever's move it is.
  const waiting =
    queue.count + (over ? over.disputes - queue.disputes.length : 0);
  const moreActive = MORE_PAGES.some((p) => p.id === page);

  const tabs = (where: 'top' | 'bottom') => (
    <>
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className="nx-tab"
          aria-current={page === id ? 'page' : undefined}
          onClick={() => navigate(id)}
        >
          <span className="nx-tab-icon">
            <Icon size={22} strokeWidth={2} aria-hidden="true" />
            {id === 'review' && waiting > 0 && where === 'bottom' && (
              <span className="nx-count" aria-hidden="true">
                {waiting}
              </span>
            )}
          </span>
          <span>{label}</span>
          {id === 'review' && waiting > 0 && where === 'top' && (
            <span className="nx-count" aria-hidden="true">
              {waiting}
            </span>
          )}
          {id === 'review' && waiting > 0 && (
            <span className="sr-only">, {waiting} waiting</span>
          )}
        </button>
      ))}
      <Menu
        side={where === 'bottom' ? 'top' : 'bottom'}
        align="end"
        trigger={
          <button
            type="button"
            className="nx-tab"
            data-active={moreActive || undefined}
          >
            <span className="nx-tab-icon">
              <Ellipsis size={22} strokeWidth={2} aria-hidden="true" />
            </span>
            <span>More</span>
          </button>
        }
        items={MORE_PAGES.map((p) => ({
          label: p.label,
          icon: p.icon,
          current: page === p.id,
          onSelect: () => navigate(p.id),
        }))}
      />
    </>
  );

  return (
    <div ref={fit} className="nx-frame" data-frame="app">
      <header ref={header} className="nx-app-header">
        <a
          className="nx-skip"
          href="#nx-main"
          onClick={(e) => {
            // Focus the page without adding #nx-main to the address.
            e.preventDefault();
            main.current?.focus();
          }}
        >
          Skip to content
        </a>
        <div className="nx-main nx-topbar">
          {page === 'home' ? (
            // Your challenges lists this challenge right below, so the top bar names the product.
            <span className="nx-brand self-center">The Challenge</span>
          ) : (
            <div className="nx-topbar-title">
              {/* The challenge's name leads to Your challenges, like the product's name before Day 1. */}
              <button
                type="button"
                className="nx-brand nx-press flex min-w-0 items-center gap-1 text-left"
                aria-label={
                  world.others.length
                    ? `${c.name}. Switch challenge`
                    : undefined
                }
                onClick={() => navigate('home')}
              >
                <span className="truncate">{c.name}</span>
                {world.others.length > 0 && (
                  <ChevronsUpDown
                    size={16}
                    className="shrink-0"
                    aria-hidden="true"
                  />
                )}
              </button>
              <button
                type="button"
                className="nx-day-link"
                onClick={() => navigate('progress')}
              >
                {world.today < c.start
                  ? `Starts ${formatDayShort(c.start)}`
                  : `Day ${dayNumber(c, world.today)} of ${c.days}`}
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          )}
          <nav className="nx-topnav" aria-label="Main">
            {tabs('top')}
          </nav>
        </div>
      </header>
      <main
        ref={main}
        id="nx-main"
        tabIndex={-1}
        className="nx-main nx-fade-in pt-2 outline-none"
      >
        {children}
      </main>
      <nav ref={tabbar} className="nx-tabbar" aria-label="Main">
        {tabs('bottom')}
      </nav>
    </div>
  );
}

/**
 * Tells the root how tall the phone tab bar (`--nx-nav-h`) and the sticky laptop header
 * (`--nx-header-h`) really are, so the action bar, sheets and toasts sit above the tab bar and focus
 * scrolls clear of both, even when large text makes them taller.
 */
function useChromeHeights(
  header: RefObject<HTMLElement | null>,
  tabbar: RefObject<HTMLElement | null>,
) {
  useLayoutEffect(() => {
    const top = header.current,
      bottom = tabbar.current,
      root = bottom?.closest<HTMLElement>('.nx');
    if (!top || !bottom || !root) return;
    const measure = () => {
      root.style.setProperty('--nx-nav-h', `${bottom.offsetHeight}px`);
      const sticky = getComputedStyle(top).position === 'sticky';
      root.style.setProperty(
        '--nx-header-h',
        `${sticky ? top.offsetHeight : 0}px`,
      );
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(top);
    watch.observe(bottom);
    window.addEventListener('resize', measure);
    return () => {
      watch.disconnect();
      window.removeEventListener('resize', measure);
      root.style.removeProperty('--nx-nav-h');
      root.style.removeProperty('--nx-header-h');
    };
  }, [header, tabbar]);
}
