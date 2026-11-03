'use client';
import { useState } from 'react';
import type { Choice } from './choices';

/**
 * Which choice's sheet is open. The choice stays set while the sheet slides closed. `initial` opens
 * on one (a theme tapped on the landing page).
 */
export function useChoiceSheet(initial: Choice | null = null) {
  const [state, setState] = useState<{ open: boolean; choice: Choice | null }>(
    () => ({ open: !!initial, choice: initial }),
  );
  return {
    ...state,
    show: (choice: Choice) => setState({ open: true, choice }),
    onOpenChange: (open: boolean) => setState((s) => ({ ...s, open })),
  };
}
