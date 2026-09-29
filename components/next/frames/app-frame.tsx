'use client';
import type { ReactNode } from 'react';
import {
  BookOpen,
  CalendarCheck,
  ChartNoAxesColumn,
  ChevronRight,
  CircleCheckBig,
  Ellipsis,
  Gift,
  House,
  Inbox,
  LayoutGrid,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { dayNumber, reviewQueue } from '@/lib/next/selectors';
import { useNav, type PageId } from '@/components/next/nav';
import { useWorld } from '@/components/next/world';
import { Menu } from '@/components/next/ui/menu';

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
 * `wide` lets the content use up to 1080px on laptops (two columns); the default is 720px.
 */
export function AppFrame({
  children,
  wide,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  const world = useWorld();
  const { page, navigate } = useNav();
  const c = world.challenge;
  const waiting = reviewQueue(world, world.me.id).count;
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
    <div className="nx-frame" data-frame="app">
      <header className="nx-app-header">
        <div className="nx-main nx-topbar" data-wide={wide || undefined}>
          <div className="flex min-w-0 flex-col">
            <p className="nx-brand truncate">{c.name}</p>
            <button
              type="button"
              className="nx-day-link self-start"
              onClick={() => navigate('progress')}
            >
              Day {dayNumber(c, world.today)} of {c.days}
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
          <nav className="nx-topnav" aria-label="Main">
            {tabs('top')}
          </nav>
        </div>
      </header>
      <main className="nx-main nx-fade-in pt-2" data-wide={wide || undefined}>
        {children}
      </main>
      <nav className="nx-tabbar" aria-label="Main">
        {tabs('bottom')}
      </nav>
    </div>
  );
}
