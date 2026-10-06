'use client';
import { useEffect, useState } from 'react';
import { readDrafts, type SavedDrafts } from '@/lib/checkin';

/** Unsaved check-ins for `uid`, kept on this phone so a reload (or iOS closing the home-screen app) does not lose them. */
export function useSavedDrafts(uid: string) {
  const key = `challenge-drafts:${uid}`;
  const [drafts, setDrafts] = useState<SavedDrafts>(() => {
    try {
      return readDrafts(localStorage.getItem(key));
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      if (Object.keys(drafts).length)
        localStorage.setItem(key, JSON.stringify(drafts));
      else localStorage.removeItem(key);
    } catch {
      // Storage blocked (private mode): drafts still last while the app is open.
    }
  }, [key, drafts]);
  return [drafts, setDrafts] as const;
}
