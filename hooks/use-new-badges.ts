'use client';
import { useEffect, useState } from 'react';
import type { Badge } from '@/lib/progress';

/** When each badge's celebration was dismissed on this device (epoch ms), by badge id. */
type Seen = Record<string, number>;

const storageKey = (uid: string) => `badges-seen:${uid}`;
/** How long a badge stays marked New on Progress after its celebration. */
const NEW_FOR = 3 * 864e5;

function read(uid: string): Seen {
  try {
    const v: unknown = JSON.parse(
      localStorage.getItem(storageKey(uid)) ?? '{}',
    );
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Seen) : {};
  } catch {
    return {};
  }
}

/**
 * The signed-in member's badges that were earned but never celebrated on this device, for the
 * celebration and the count on Progress. Remembered in this browser only, so a new phone (or a
 * cleared one) celebrates every earned badge once.
 */
export function useNewBadges(uid: string, badges: Badge[], now: number) {
  const [seen, setSeen] = useState<Seen>(() => read(uid));
  // A celebration dismissed in another tab counts here too.
  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key === storageKey(uid)) setSeen(read(uid));
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [uid]);
  return {
    /** Earned and not yet celebrated here, in badge order. */
    fresh: badges.filter((b) => b.earned && seen[b.id] === undefined),
    /** Marked New on Progress: not yet celebrated, or celebrated in the last three days. */
    isNew: (id: string) => seen[id] === undefined || now - seen[id] < NEW_FOR,
    /** Records that these badges have been celebrated. */
    markSeen: (ids: string[]) => {
      const next = { ...seen },
        at = Date.now();
      for (const id of ids) next[id] ??= at;
      setSeen(next);
      try {
        localStorage.setItem(storageKey(uid), JSON.stringify(next));
        // The list the old nav count kept of badges seen on Progress.
        localStorage.removeItem(`badges:${uid}`);
      } catch {}
    },
  };
}
