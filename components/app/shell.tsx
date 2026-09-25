'use client';
import type { ReactNode } from 'react';
import {
  Check,
  ClipboardList,
  Home,
  LogOut,
  RefreshCw,
  TrendingUp,
  X,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { supabase } from '@/lib/supabase';
import { NAV_PAGES, type Page } from './challenge-context';

const NAV_ICONS = [Home, ClipboardList, Check, TrendingUp];

export type ShellProps = {
  page: Page;
  go: (p: Page) => void;
  name?: string;
  /** Anything waiting in Review (desktop dot). */
  reviewDot: boolean;
  /** Items across the Review tabs (mobile badge). */
  reviewCount: number;
  newBadges: number;
  error: string;
  setError: (e: string) => void;
  refresh: () => Promise<void>;
  children: ReactNode;
};

/** Top bar, error bar, page content and the mobile navigation. */
export function Shell({
  page,
  go,
  name,
  reviewDot,
  reviewCount,
  newBadges,
  error,
  setError,
  refresh,
  children,
}: ShellProps) {
  return (
    <div className="app-shell">
      <header className="topbar glass">
        {/* oxlint-disable-next-line jsx-a11y/anchor-is-valid -- styled as the brand link */}
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            go('Overview');
          }}
        >
          30 DAY CHALLENGE
        </a>
        <nav className="desktop-nav" aria-label="Main navigation">
          {NAV_PAGES.map((p) => (
            <button
              key={p}
              className={page === p ? 'active' : ''}
              onClick={() => go(p)}
            >
              {p}
              {p === 'Review' && reviewDot && <span className="nav-dot" />}
              {p === 'Progress' && newBadges > 0 && (
                <span className="nav-dot" />
              )}
            </button>
          ))}
        </nav>
        <div className="account">
          <span className="avatar" title={name ?? 'Your account'}>
            {name?.[0] ?? '·'}
          </span>
          <span className="account-name">{name}</span>
          <ThemeToggle />
          <button
            title="Sign out"
            aria-label="Sign out"
            onClick={() => void supabase.auth.signOut()}
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>
      <main>
        {error && (
          <div className="error-bar" role="alert">
            <span>
              {error.includes('schema cache')
                ? 'The database setup is not complete yet. Your account is connected.'
                : error}
            </span>
            <button onClick={() => void refresh()} aria-label="Retry loading">
              <RefreshCw size={16} />
            </button>
            <button onClick={() => setError('')} aria-label="Dismiss error">
              <X size={16} />
            </button>
          </div>
        )}
        {children}
      </main>
      <nav className="mobile-nav glass" aria-label="Mobile navigation">
        {NAV_PAGES.map((p, i) => {
          const Icon = NAV_ICONS[i];
          return (
            <button
              className={page === p ? 'active' : ''}
              onClick={() => go(p)}
              key={p}
            >
              <Icon size={19} strokeWidth={1.45} />
              <span>{p}</span>
              {p === 'Review' && reviewCount > 0 && (
                <b className="nav-badge">{reviewCount}</b>
              )}
              {p === 'Progress' && newBadges > 0 && (
                <b className="nav-badge">{newBadges}</b>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
