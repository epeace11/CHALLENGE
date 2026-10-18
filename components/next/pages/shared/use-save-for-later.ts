'use client';
import { useState } from 'react';
import { useBackend } from '@/components/next/backend';
import { useToast } from '@/components/next/ui';

/**
 * "Save for later": keeps the challenge in Your challenges, confirmed by a toast with Undo. Tapping
 * Saved takes it out again. Local to the preview: the sample world already lists it.
 */
export function useSaveForLater(name: string) {
  const toast = useToast();
  const { host } = useBackend();
  const [saved, setSaved] = useState(false);
  const toggle = () => {
    // The live app saves a copy to the account; it stays saved.
    if (host) {
      if (saved) return;
      void host.saveShared().then((ok) => {
        if (!ok) return;
        setSaved(true);
        toast(`${name} saved to Your challenges`);
      });
      return;
    }
    if (saved) {
      setSaved(false);
      toast(`${name} removed from Your challenges`);
      return;
    }
    setSaved(true);
    toast({
      text: `${name} saved to Your challenges`,
      action: { label: 'Undo', onClick: () => setSaved(false) },
    });
  };
  return { saved, toggle };
}
