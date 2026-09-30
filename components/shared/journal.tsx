'use client';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { ArrowDown, LoaderCircle, Pencil } from 'lucide-react';
import { useChallenge } from '@/components/app/challenge-context';
import { GrowingTextarea } from '@/components/shared/growing-textarea';
import { api } from '@/lib/api';
import {
  formatDate,
  formatDayHeading,
  formatShortDate,
  formatTime,
  shift,
  toronto,
} from '@/lib/dates';
import { byDay, continues, covers, notesOn } from '@/lib/journal';
import { nameOf } from '@/lib/selectors';
import type { Journal as Note } from '@/lib/types';

/**
 * The shared journal. Both people's notes live in one list (`data.journals`, loaded a page at a
 * time; see lib/journal.ts) with two views over it: the running feed on the Overview and Log
 * pages, and one day's notes in the day view. Every Add writes a new note; nothing is overwritten.
 */

const cmdEnter = (e: KeyboardEvent, fn: () => void) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    fn();
  }
};

const reducedMotion = () =>
  typeof matchMedia === 'function' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches;

/** "Today · Sep 30", "Yesterday · Sep 29", or "Monday, September 28". */
function dayLabel(day: string, today: string) {
  if (day === today) return `Today · ${formatShortDate(day)}`;
  if (day === shift(today, -1)) return `Yesterday · ${formatShortDate(day)}`;
  return formatDayHeading(day);
}

/** One note: who wrote it and when, and for its author an Edit that also offers Remove. */
function NoteItem({
  note,
  compact,
  fresh = false,
}: {
  note: Note;
  /** Same person, moments after their last note: the name and picture are not repeated. */
  compact: boolean;
  fresh?: boolean;
}) {
  const { data, me, busy, run } = useChallenge();
  const [editing, setEditing] = useState<string | null>(null),
    [confirmRemove, setConfirmRemove] = useState(false);
  const mine = note.user_id === me.id,
    name = nameOf(data, note.user_id) ?? '',
    written = toronto(new Date(note.created_at));
  const stopEditing = () => {
    setEditing(null);
    setConfirmRemove(false);
  };
  const save = async () => {
    const t = editing?.trim();
    if (t && (await run(() => api.editNote(note.id, t)))) stopEditing();
  };
  return (
    <li
      className={[
        'journal-note',
        `author-${name.toLowerCase()}`,
        compact && 'compact',
        editing !== null && 'editing',
        fresh && 'fresh',
      ]
        .filter(Boolean)
        .join(' ')}
      data-note={note.id}
    >
      {!compact && (
        <span className="journal-avatar" aria-hidden>
          {name.slice(0, 1)}
        </span>
      )}
      <div className="journal-body">
        <div className="journal-meta">
          {!compact && <b className="journal-author">{name}</b>}
          <time className="journal-time" dateTime={note.created_at}>
            {formatTime(note.created_at)}
            {written !== note.day && ` · written ${formatShortDate(written)}`}
          </time>
          {mine && editing === null && (
            <button
              type="button"
              className="journal-edit"
              aria-label="Edit this note"
              disabled={busy}
              onClick={() => setEditing(note.text)}
            >
              <Pencil size={15} />
            </button>
          )}
        </div>
        {editing === null ? (
          <p className="journal-text">{note.text}</p>
        ) : (
          <>
            <GrowingTextarea
              aria-label="Edit this note"
              value={editing}
              focusOnMount
              disabled={busy}
              onChange={setEditing}
              onKeyDown={(e) => {
                cmdEnter(e, () => void save());
                if (e.key === 'Escape') stopEditing();
              }}
            />
            <div className="journal-edit-actions">
              <button
                type="button"
                className={`text-link journal-remove${confirmRemove ? ' sure' : ''}`}
                disabled={busy}
                onClick={() =>
                  confirmRemove
                    ? void run(() => api.deleteNote(note.id))
                    : setConfirmRemove(true)
                }
              >
                {confirmRemove ? 'Tap again to remove' : 'Remove'}
              </button>
              <button
                type="button"
                className="text-link"
                disabled={busy}
                onClick={stopEditing}
              >
                Cancel
              </button>
              <button
                type="button"
                className="journal-add"
                disabled={
                  busy || !editing.trim() || editing.trim() === note.text
                }
                onClick={() => void save()}
              >
                Save
              </button>
            </div>
          </>
        )}
      </div>
    </li>
  );
}

function NoteList({ notes, fresh }: { notes: Note[]; fresh?: string | null }) {
  return (
    <ol className="journal-notes">
      {notes.map((n, i) => (
        <NoteItem
          key={n.id}
          note={n}
          compact={continues(notes[i - 1], n)}
          fresh={n.id === fresh}
        />
      ))}
    </ol>
  );
}

/** Writes a new note to `day`. Each Add is its own note; earlier ones are never replaced. */
function Composer({
  day,
  onAdded,
}: {
  day: string;
  onAdded?: (id: string) => void;
}) {
  const { busy, run, today, journal } = useChallenge();
  const [draft, setDraft] = useState(''),
    [key, setKey] = useState(day);
  if (key !== day) {
    setKey(day);
    setDraft('');
  }
  const add = async () => {
    const t = draft.trim();
    if (!t) return;
    const ok = await run(async () => {
      onAdded?.(await api.addNote(day, t));
      // A note for an older day must be inside the loaded window, or the reload would miss it.
      await journal.reach(day);
    });
    if (ok) setDraft('');
  };
  const label =
    day === today
      ? 'Write in today’s journal'
      : `Write in the journal for ${formatShortDate(day)}`;
  return (
    <div className="journal-composer">
      <GrowingTextarea
        aria-label={`${label} (${formatDate(day)})`}
        placeholder={label}
        value={draft}
        disabled={busy}
        onChange={setDraft}
        onKeyDown={(e) => cmdEnter(e, () => void add())}
      />
      <button
        type="button"
        className="journal-add"
        disabled={busy || !draft.trim()}
        onClick={() => void add()}
      >
        Add
      </button>
    </div>
  );
}

/**
 * The running journal: every day's notes from both people, oldest at the top and newest at the
 * bottom, in its own scrolling box. It opens at the newest notes (or, with `focus`, at `day`) and
 * loads older pages as you scroll up without moving what you are reading. Each day's heading sticks
 * to the top of the box while its notes scroll by, so the date in view is always showing. The
 * composer writes to `day`.
 */
export function JournalFeed({
  day,
  focus = false,
}: {
  day: string;
  focus?: boolean;
}) {
  const { data, me, today, journal, dialogs } = useChallenge();
  const { window: loaded, loadingOlder, loadOlder, reach } = journal;
  const notes = data.journals,
    ready = loaded !== null,
    hasMore = ready && loaded !== 'all',
    focusDay = focus && day !== today ? day : undefined,
    groups = byDay(
      notes,
      focusDay && covers(loaded, focusDay) ? focusDay : undefined,
    );

  const box = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true),
    [unseen, setUnseen] = useState(false),
    [fresh, setFresh] = useState<string | null>(null);
  // What the box should hold on to across renders: the bottom, or the note at the top of the view
  // and how far down it sat; plus a note or day to bring into view once it has rendered.
  const pin = useRef<{
    bottom: boolean;
    anchor: { id: string; offset: number } | null;
    target: { note: string } | { day: string } | null;
    last: string | undefined;
  }>({ bottom: true, anchor: null, target: null, last: undefined });

  /** Records where the view is: at the bottom or not, and the first note showing. */
  const measure = () => {
    const el = box.current;
    if (!el) return;
    const p = pin.current,
      top = el.getBoundingClientRect().top;
    p.bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    setAtBottom(p.bottom);
    if (p.bottom) setUnseen(false);
    p.anchor = null;
    for (const n of el.querySelectorAll<HTMLElement>('[data-note]')) {
      const r = n.getBoundingClientRect();
      if (r.bottom > top) {
        p.anchor = { id: n.dataset.note ?? '', offset: r.top - top };
        break;
      }
    }
  };

  /** After notes change: show the target if one is waiting, else stay at the bottom, else keep the anchor note still. */
  const settle = () => {
    const el = box.current;
    if (!el) return;
    const p = pin.current,
      top = el.getBoundingClientRect().top,
      find = (sel: string) => el.querySelector<HTMLElement>(sel);
    const t = p.target;
    const target =
      t &&
      ('note' in t
        ? find(`[data-note="${t.note}"]`)
        : find(`[data-day="${t.day}"]`));
    if (t && target) {
      const r = target.getBoundingClientRect();
      if ('note' in t) {
        // A note you just wrote: bring it into view clear of the Newest button, and mark it for a moment.
        el.scrollTop += Math.max(0, r.bottom - top - el.clientHeight + 64);
        setFresh(t.note);
      } else el.scrollTop += r.top - top;
      p.target = null;
    } else if (p.bottom) el.scrollTop = el.scrollHeight;
    else if (p.anchor) {
      const a = find(`[data-note="${p.anchor.id}"]`);
      if (a)
        el.scrollTop += a.getBoundingClientRect().top - top - p.anchor.offset;
    }
    // Someone else's note arrived below while you were reading further up.
    const last = notes.at(-1);
    if (
      p.last !== undefined &&
      last &&
      last.id !== p.last &&
      last.user_id !== me.id &&
      !p.bottom
    )
      setUnseen(true);
    p.last = last?.id;
    measure();
    // Too little above to scroll into: fetch more now rather than waiting for a scroll.
    if (hasMore && el.scrollTop < el.clientHeight) void loadOlder();
  };

  // Runs before paint, so older notes slotting in above never show as a jump. Only a change in
  // what is listed should move the view; settle reads everything else fresh.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(settle, [notes, loaded, focusDay]);

  // On the Log page for an earlier day, open the feed at that day.
  useEffect(() => {
    if (!focusDay) return;
    pin.current.target = { day: focusDay };
    pin.current.bottom = false;
    void reach(focusDay).then(() => requestAnimationFrame(settle));
    // settle reads the latest refs; re-running on its identity would re-target on every render.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [focusDay, reach, ready]);

  const frame = useRef(0);
  const onScroll = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      measure();
      const el = box.current;
      // Start fetching well before the top, so scrolling rarely has to wait.
      if (el && hasMore && el.scrollTop < el.clientHeight * 1.5)
        void loadOlder();
    });
  };

  const toNewest = () => {
    const el = box.current;
    if (!el) return;
    pin.current.bottom = true;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: reducedMotion() ? 'auto' : 'smooth',
    });
  };

  return (
    <>
      <div className="journal-feed-wrap">
        <div
          className="journal-feed"
          ref={box}
          onScroll={onScroll}
          aria-busy={!ready || loadingOlder}
        >
          {!ready ? (
            <p className="journal-edge">
              <LoaderCircle size={16} className="spin" /> Opening the journal
            </p>
          ) : hasMore ? (
            <p className="journal-edge">
              {loadingOlder ? (
                <>
                  <LoaderCircle size={16} className="spin" /> Loading earlier
                  entries
                </>
              ) : (
                <button
                  type="button"
                  className="text-link"
                  onClick={() => void loadOlder()}
                >
                  Show earlier entries
                </button>
              )}
            </p>
          ) : groups.length ? (
            <p className="journal-edge">The first page of your journal</p>
          ) : (
            <p className="journal-empty">
              No entries yet. Anything either of you writes shows up here, by
              day.
            </p>
          )}
          {groups.map((g) => (
            <section key={g.day} className="journal-day" data-day={g.day}>
              <h4 className="journal-date">
                <button
                  type="button"
                  aria-label={`Open ${formatDate(g.day)}`}
                  onClick={() => dialogs.openDay(g.day, me.id)}
                >
                  {dayLabel(g.day, today)}
                </button>
              </h4>
              {g.notes.length ? (
                <NoteList notes={g.notes} fresh={fresh} />
              ) : (
                <p className="journal-none">
                  Nothing written for this day yet.
                </p>
              )}
            </section>
          ))}
        </div>
        {!atBottom && (
          <button
            type="button"
            className={`journal-jump${unseen ? ' unseen' : ''}`}
            onClick={toNewest}
          >
            <ArrowDown size={16} />
            {unseen ? 'New entry' : 'Newest'}
          </button>
        )}
      </div>
      <Composer
        day={day}
        onAdded={(id) => {
          pin.current.target = { note: id };
        }}
      />
    </>
  );
}

/** One day's journal: every note either person wrote for `day`, in the order written, and a composer for it. */
export function DayJournal({ day }: { day: string }) {
  const { data, journal } = useChallenge();
  const { window: loaded, reach } = journal;
  const [fresh, setFresh] = useState<string | null>(null);
  const ready = covers(loaded, day),
    notes = notesOn(data.journals, day);
  const started = loaded !== null;
  useEffect(() => {
    if (started) void reach(day);
  }, [day, reach, started]);
  return (
    <div className="journal-box">
      {!ready ? (
        <p className="journal-edge">
          <LoaderCircle size={16} className="spin" /> Loading this day’s entries
        </p>
      ) : notes.length ? (
        <NoteList notes={notes} fresh={fresh} />
      ) : (
        <p className="journal-none">Nothing written for this day yet.</p>
      )}
      <Composer day={day} onAdded={setFresh} />
    </div>
  );
}
