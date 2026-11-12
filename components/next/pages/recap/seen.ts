'use client';
import { useSyncExternalStore } from 'react';

/**
 * Which week's recap each person has opened, on this device: { challenge id: week start } in
 * localStorage 'nx-recap-seen'. Overview shows a new recap as a card until it's opened, then as a
 * quiet link. Without storage (a private window) every recap counts as new.
 */
const KEY = 'nx-recap-seen';
const listeners = new Set<() => void>();

function read(): Record<string, string> {
  try {
    const all: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return all && typeof all === 'object'
      ? (all as Record<string, string>)
      : {};
  } catch {
    return {};
  }
}

/** Marks a week's recap as opened (the recap page calls it). */
export function markRecapSeen(challengeId: string, weekStart: string) {
  try {
    const all = read();
    if (all[challengeId] === weekStart) return;
    localStorage.setItem(
      KEY,
      JSON.stringify({ ...all, [challengeId]: weekStart }),
    );
  } catch {}
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** True once this week's recap has been opened. On the server it counts as opened (the quiet link). */
export function useRecapSeen(challengeId: string, weekStart: string | null) {
  return useSyncExternalStore(
    subscribe,
    () => !!weekStart && read()[challengeId] === weekStart,
    () => true,
  );
}
