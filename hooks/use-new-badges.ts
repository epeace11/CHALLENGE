'use client';
import { useEffect } from 'react';
import type { Badge } from '@/lib/progress';

const storageKey = (uid: string) => `badges:${uid}`;

/**
 * Badges earned since the last Progress visit, remembered on this phone only.
 * Storage is read on every render so the nav dot clears as soon as Progress is left.
 */
export function useNewBadges(
  uid: string,
  badges: Badge[],
  onProgress: boolean,
) {
  const seen = (() => {
    if (typeof localStorage === 'undefined') return null;
    try {
      return JSON.parse(
        localStorage.getItem(storageKey(uid)) ?? '[]',
      ) as string[];
    } catch {
      return [];
    }
  })();
  useEffect(() => {
    if (!onProgress) return;
    try {
      localStorage.setItem(
        storageKey(uid),
        JSON.stringify(badges.filter((b) => b.earned).map((b) => b.id)),
      );
    } catch {}
  }, [onProgress, uid, badges]);
  return seen
    ? badges.filter((b) => b.earned && !seen.includes(b.id)).length
    : 0;
}
