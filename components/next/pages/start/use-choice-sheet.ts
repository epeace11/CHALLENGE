'use client';
import { useState } from 'react';
import type { Choice } from './choices';

/** Which choice's sheet is open. The choice stays set while the sheet slides closed. */
export function useChoiceSheet() {
  const [state, setState] = useState<{ open: boolean; choice: Choice | null }>({
    open: false,
    choice: null,
  });
  return {
    ...state,
    show: (choice: Choice) => setState({ open: true, choice }),
    onOpenChange: (open: boolean) => setState((s) => ({ ...s, open })),
  };
}
