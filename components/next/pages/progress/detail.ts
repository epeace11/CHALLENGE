'use client';
import { useState } from 'react';
import type { DateString } from '@/lib/next/model';

/** What the Progress sheet shows. Views stack: a day opens its habits, a habit opens its days. */
export type DetailView =
  | { kind: 'habit'; personId: string; ruleId: string }
  | { kind: 'day'; personId: string; day: DateString }
  | { kind: 'badge'; personId: string; badgeId: string }
  | { kind: 'badges'; personId: string };

/** The sheet's state: whether it is open and the views it has stacked. */
export function useDetail() {
  const [state, setState] = useState<{
    isOpen: boolean;
    stack: DetailView[];
    dir: 1 | -1;
  }>({ isOpen: false, stack: [], dir: 1 });
  return {
    ...state,
    /** Opens the sheet on one view. */
    show: (view: DetailView) =>
      setState({ isOpen: true, stack: [view], dir: 1 }),
    /** Moves further in, keeping the way back. */
    push: (view: DetailView) =>
      setState((s) => ({ ...s, stack: [...s.stack, view], dir: 1 })),
    back: () =>
      setState((s) => ({
        ...s,
        stack: s.stack.length > 1 ? s.stack.slice(0, -1) : s.stack,
        dir: -1,
      })),
    close: () => setState((s) => ({ ...s, isOpen: false })),
  };
}

export type Detail = ReturnType<typeof useDetail>;
