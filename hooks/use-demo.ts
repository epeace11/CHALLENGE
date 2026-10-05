'use client';
import { useState, useSyncExternalStore } from 'react';
import { demoData } from '@/lib/demo';
import type { Person } from '@/lib/rules';
import { goOffline } from '@/lib/supabase';

/**
 * Demo mode, for checking pages without the live database: only on localhost, opened with
 * ?demo (as Erin) or ?demo=kazzy, optionally ?at=2026-10-16T12:00 to see another moment.
 * The data is made up (lib/demo.ts) and nothing is saved: every write fails with a note.
 */
export type Demo = { as: Person };

function readDemo(): Demo | null {
  const { hostname, search } = window.location,
    q = new URLSearchParams(search);
  if (!q.has('demo') || !['localhost', '127.0.0.1', '[::1]'].includes(hostname))
    return null;
  goOffline();
  // Moves the whole app's clock: every new Date() and Date.now() runs from ?at.
  const at = Date.parse(q.get('at') ?? '');
  if (!Number.isNaN(at)) {
    const Real = Date,
      offset = at - Real.now();
    class Shifted extends Real {
      constructor(...a: []) {
        if (a.length) super(...a);
        else super(Real.now() + offset);
      }
      static now() {
        return Real.now() + offset;
      }
    }
    globalThis.Date = Shifted as DateConstructor;
  }
  return { as: q.get('demo')?.toLowerCase() === 'kazzy' ? 'Kazzy' : 'Erin' };
}

let demo: Demo | null | undefined;
const noSubscribe = () => () => {};
/** The demo settings on the client, null when not in demo mode, undefined while rendering on the server. */
export const useDemo = () =>
  useSyncExternalStore(
    noSubscribe,
    () => (demo === undefined ? (demo = readDemo()) : demo),
    () => undefined,
  );

/** A store shaped like useChallengeData's, holding the made-up data. */
export function useDemoStore() {
  const [data] = useState(() => demoData(Date.now())),
    [error, setError] = useState('');
  return {
    data,
    finalized: false,
    loading: false,
    error,
    setError,
    refresh: () => Promise.resolve(),
    journal: {
      window: 'all' as const,
      loadingOlder: false,
      loadOlder: () => Promise.resolve(),
      reach: () => Promise.resolve(),
    },
  };
}
