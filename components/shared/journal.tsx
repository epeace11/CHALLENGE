'use client';
import { useState, type KeyboardEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { useChallenge } from '@/components/app/challenge-context';
import { GrowingTextarea } from '@/components/shared/growing-textarea';
import { api } from '@/lib/api';
import { formatDate, formatShortDate, formatTime, toronto } from '@/lib/dates';
import { notesOf } from '@/lib/selectors';
import type { Journal as Note } from '@/lib/types';

/** One person's journal for one day: every note they added, oldest first, plus a composer when it is theirs. Tap one of your own notes to edit it. */
function JournalBox({
  day,
  notes,
  mine,
  disabled = false,
  onAdd,
  onEdit,
  onDelete,
}: {
  day: string;
  notes: Note[];
  mine: boolean;
  disabled?: boolean;
  onAdd: (t: string) => Promise<unknown>;
  onEdit: (id: string, t: string) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState(''),
    [key, setKey] = useState(day),
    [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  if (key !== day) {
    setKey(day);
    setDraft('');
    setEditing(null);
  }
  const submit = (e: KeyboardEvent, fn: () => void) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      fn();
    }
  };
  const add = () => {
    const t = draft.trim();
    if (!t) return;
    void onAdd(t).then(() => setDraft(''));
  };
  const save = () => {
    if (!editing) return;
    const t = editing.text.trim();
    if (!t) return;
    void onEdit(editing.id, t).then(() => setEditing(null));
  };
  return (
    <div className="journal-box">
      {notes.length > 0 && (
        <ol className="journal-notes">
          {notes.map((n) =>
            editing?.id === n.id ? (
              <li key={n.id} className="editing">
                <div className="journal-meta">
                  <span className="journal-time">
                    {formatTime(n.created_at)} · editing
                  </span>
                </div>
                <GrowingTextarea
                  aria-label="Edit this note"
                  value={editing.text}
                  focusOnMount
                  disabled={disabled}
                  onChange={(text) => setEditing({ id: n.id, text })}
                  onKeyDown={(e) => {
                    submit(e, save);
                    if (e.key === 'Escape') setEditing(null);
                  }}
                />
                <div className="journal-edit-actions">
                  <button
                    type="button"
                    className="text-link"
                    disabled={disabled}
                    onClick={() => setEditing(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="journal-add"
                    disabled={
                      disabled ||
                      !editing.text.trim() ||
                      editing.text.trim() === n.text
                    }
                    onClick={save}
                  >
                    Save
                  </button>
                </div>
              </li>
            ) : (
              <li key={n.id}>
                <div className="journal-meta">
                  <span className="journal-time">
                    {formatTime(n.created_at)}
                  </span>
                  {mine && (
                    <button
                      type="button"
                      className="journal-remove"
                      aria-label="Remove this note"
                      disabled={disabled}
                      onClick={() => void onDelete(n.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                {mine ? (
                  <button
                    type="button"
                    className="journal-text editable"
                    title="Tap to edit"
                    disabled={disabled}
                    onClick={() => setEditing({ id: n.id, text: n.text })}
                  >
                    {n.text}
                  </button>
                ) : (
                  <p className="journal-text">{n.text}</p>
                )}
              </li>
            ),
          )}
        </ol>
      )}
      {mine ? (
        <div className="journal-composer">
          <GrowingTextarea
            aria-label={`Add to your journal for ${formatDate(day)}`}
            placeholder={
              day === toronto()
                ? 'Add to today’s journal'
                : `Add to ${formatShortDate(day)}’s journal`
            }
            value={draft}
            disabled={disabled}
            onChange={setDraft}
            onKeyDown={(e) => submit(e, add)}
          />
          <button
            type="button"
            className="journal-add"
            disabled={disabled || !draft.trim()}
            onClick={add}
          >
            Add
          </button>
        </div>
      ) : (
        !notes.length && (
          <p className="muted small journal-empty">
            Nothing written for this day.
          </p>
        )
      )}
    </div>
  );
}

/** `uid`'s journal for `day`, editable when it is the signed-in member's. */
export function DayJournal({ uid, day }: { uid: string; day: string }) {
  const { data, me, busy, run } = useChallenge();
  return (
    <JournalBox
      day={day}
      notes={notesOf(data, uid, day)}
      mine={uid === me.id}
      disabled={busy}
      onAdd={(t) => run(() => api.addNote(day, t))}
      onEdit={(id, t) => run(() => api.editNote(id, t))}
      onDelete={(id) => run(() => api.deleteNote(id))}
    />
  );
}
