'use client';
import { useState } from 'react';
import { useBackend } from '@/components/next/backend';

/**
 * "Save for later": keeps the challenge in Your challenges; the button turns into Saved. Tapping
 * Saved takes it out again. Local to the preview: the sample world already lists it.
 */
export function useSaveForLater() {
  const { host } = useBackend();
  const [saved, setSaved] = useState(false);
  const toggle = () => {
    // The live app saves a copy to the account; it stays saved.
    if (host) {
      if (saved) return;
      void host.saveShared().then((ok) => {
        if (ok) setSaved(true);
      });
      return;
    }
    setSaved(!saved);
  };
  return { saved, toggle };
}
