'use client';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { world as sampleWorld } from '@/lib/next/demo';
import type { World } from '@/lib/next/model';

/**
 * The sample world as shared, changeable state for the preview. Pages read it with useWorld() and
 * change it with useDemo().update(fn), where fn is a pure action from lib/next/actions.ts. Changes
 * last while the preview is open (moving between pages keeps them) and never leave the browser.
 */

type Demo = {
  world: World;
  /**
   * Applies a pure change: `update((w) => approve(w, id))`. Pass `{ undoable: false }` for changes
   * Undo should skip (the preview's look menu).
   */
  update: (
    change: (w: World) => World,
    options?: { undoable?: boolean },
  ) => void;
  /** Takes back the last change (for a toast's Undo). */
  undo: () => void;
  canUndo: boolean;
  /** Back to the untouched sample world. */
  reset: () => void;
};

const DemoContext = createContext<Demo>({
  world: sampleWorld,
  update: () => {},
  undo: () => {},
  canUndo: false,
  reset: () => {},
});

export function WorldProvider({
  children,
  initial = sampleWorld,
}: {
  children: ReactNode;
  initial?: World;
}) {
  const [state, setState] = useState<{ world: World; past: World[] }>({
    world: initial,
    past: [],
  });
  const update = useCallback(
    (change: (w: World) => World, options?: { undoable?: boolean }) =>
      setState((s) => {
        const next = change(s.world);
        if (next === s.world) return s;
        return options?.undoable === false
          ? { world: next, past: s.past }
          : { world: next, past: [...s.past, s.world].slice(-30) };
      }),
    [],
  );
  const undo = useCallback(
    () =>
      setState((s) =>
        s.past.length
          ? { world: s.past[s.past.length - 1], past: s.past.slice(0, -1) }
          : s,
      ),
    [],
  );
  const reset = useCallback(
    () => setState({ world: initial, past: [] }),
    [initial],
  );
  const value = useMemo(
    () => ({
      world: state.world,
      update,
      undo,
      canUndo: state.past.length > 0,
      reset,
    }),
    [state, update, undo, reset],
  );
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

/** The world every page shows. Maya is `me`, Jordan is `partner`. */
export const useWorld = () => useContext(DemoContext).world;

/** The world plus update, undo and reset. */
export const useDemo = () => useContext(DemoContext);
