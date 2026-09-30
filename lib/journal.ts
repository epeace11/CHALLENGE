import type { Journal } from './types.ts';

/**
 * The shared journal: every note either person has written, on any day. The app never loads the
 * whole journal at once. It keeps a window, from some point back in time to the newest note, and
 * every reload refreshes exactly that window; scrolling up (or opening an older day) moves the
 * window's start further back. The running feed and a single day's view both read the same notes.
 */

/** How many notes load at a time: the newest ones first, then each step back. */
export const JOURNAL_PAGE = 40;

/**
 * Where the loaded window starts. Every note from here to the newest is loaded and kept fresh.
 * `at` is the first loaded note's `created_at` on `day`, or null when the whole of `day` is loaded.
 * 'all' is the whole journal; null is before the first load.
 */
export type JournalCursor = { day: string; at: string | null };
export type JournalWindow = JournalCursor | 'all' | null;

/** Feed order: by day, then in the order written. (Timestamps from the database compare as strings.) */
export const compareNotes = (a: Journal, b: Journal) =>
  a.day.localeCompare(b.day) ||
  a.created_at.localeCompare(b.created_at) ||
  a.id.localeCompare(b.id);

/** Whether `n` falls inside the window, whose notes each reload replaces. */
export const inWindow = (n: Journal, w: JournalWindow) =>
  w === null ||
  w === 'all' ||
  n.day > w.day ||
  (n.day === w.day && (w.at === null || n.created_at >= w.at));

/** Whether every note of `day` is loaded. */
export const covers = (w: JournalWindow, day: string) =>
  w === 'all' ||
  (w !== null && (day > w.day || (day === w.day && w.at === null)));

/** The window's start after a page of notes (newest first) came back: 'all' once a page runs short. */
export function startOf(page: Journal[], size = JOURNAL_PAGE): JournalWindow {
  const oldest = page.at(-1);
  return page.length < size || !oldest
    ? 'all'
    : { day: oldest.day, at: oldest.created_at };
}

/**
 * A reload of window `asked` lands: its notes replace every loaded note inside that window (so edits
 * and removals show), and older notes loaded meanwhile by scrolling up are kept.
 */
export const landNotes = (
  current: Journal[],
  fetched: Journal[],
  asked: JournalWindow,
) =>
  [
    ...(asked === null || asked === 'all'
      ? []
      : current.filter((n) => !inWindow(n, asked))),
    ...fetched,
  ].sort(compareNotes);

/** Adds older notes (the next page up, or an older day opened), replacing any already loaded. */
export function addOlder(current: Journal[], older: Journal[]) {
  const ids = new Set(older.map((n) => n.id));
  return [...older, ...current.filter((n) => !ids.has(n.id))].sort(
    compareNotes,
  );
}

/** Notes on one day, both people's, in the order written. */
export const notesOn = (notes: Journal[], day: string) =>
  notes.filter((n) => n.day === day).sort(compareNotes);

/** Notes grouped by day, oldest day first; `alsoDay` gets an empty group when it has no notes. */
export function byDay(notes: Journal[], alsoDay?: string) {
  const groups: { day: string; notes: Journal[] }[] = [];
  for (const n of [...notes].sort(compareNotes)) {
    const last = groups.at(-1);
    if (last?.day === n.day) last.notes.push(n);
    else groups.push({ day: n.day, notes: [n] });
  }
  if (alsoDay && !groups.some((g) => g.day === alsoDay)) {
    groups.push({ day: alsoDay, notes: [] });
    groups.sort((a, b) => a.day.localeCompare(b.day));
  }
  return groups;
}

/** Whether `n` continues `prev` (same author, same day, within 15 minutes), so the feed can drop the repeated name. */
export const continues = (prev: Journal | undefined, n: Journal) =>
  !!prev &&
  prev.user_id === n.user_id &&
  prev.day === n.day &&
  Date.parse(n.created_at) - Date.parse(prev.created_at) < 15 * 60e3;
