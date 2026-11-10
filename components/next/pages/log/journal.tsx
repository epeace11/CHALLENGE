'use client';
import { useRef, useState } from 'react';
import { PencilLine, Plus, Trash2 } from 'lucide-react';
import type { DateString, JournalNote } from '@/lib/next/model';
import { addNote, editNote, removeNote } from '@/lib/next/actions';
import { formatWeekday, personById } from '@/lib/next/selectors';
import {
  Avatar,
  Button,
  Card,
  IconButton,
  Item,
  Presence,
  Section,
  Sheet,
  TextField,
} from '@/components/next/ui';
import { useBackend } from '@/components/next/backend';
import { useWorld } from '@/components/next/world';
import { useWhy, WhyLine } from './why';

/** Why Add note can't add yet. */
const EMPTY_NOTE = 'Write a note to add.';

/**
 * The day's notes by both people, oldest first, and adding, changing or removing one. No toast:
 * the note appears in, changes in or leaves the list on screen.
 */
export function useNotes(day: DateString) {
  const world = useWorld();
  const backend = useBackend();
  const notes = world.journal
    .filter((n) => n.day === day)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const add = (text: string) => {
    if (!text.trim()) return false;
    backend.act({ type: 'addNote', day, text: text.trim() }, (w) =>
      addNote(w, world.me.id, day, text),
    );
    return true;
  };
  const remove = (id: string) =>
    backend.act({ type: 'removeNote', noteId: id }, (w) => removeNote(w, id));
  /** Saves new words for one of the viewer's notes; an empty note is removed instead. */
  const edit = (id: string, text: string) =>
    backend.act({ type: 'editNote', noteId: id, text: text.trim() }, (w) =>
      editNote(w, id, text),
    );
  return { notes, add, remove, edit };
}

type NoteActions = Pick<ReturnType<typeof useNotes>, 'remove' | 'edit'>;

/**
 * One note. The viewer's own notes have Change and Remove; Change turns the note into a field.
 * Removing asks first, in the note itself (there is no undo), and so does saving it empty.
 */
function NoteItem({
  note,
  actions,
}: {
  note: JournalNote;
  actions: NoteActions;
}) {
  const world = useWorld();
  const person = personById(world, note.personId),
    mine = note.personId === world.me.id;
  const [draft, setDraft] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  // Save note stays filled while the words are unchanged; pressed then, it says so.
  const box = useRef<HTMLDivElement>(null);
  const why = useWhy(
    draft !== null && draft.trim() === note.text
      ? 'Change the note to save.'
      : null,
    box,
  );
  if (asking)
    return (
      <Card pad="sm" className="flex flex-col gap-3">
        <p className="text-nx-body whitespace-pre-line [overflow-wrap:anywhere] text-nx-ink">
          {note.text}
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <p className="w-full text-nx-2 font-semibold text-nx-ink">
            Remove this note?
          </p>
          <Button
            variant="quiet"
            // Focus lands on Keep, the safe choice, so a keyboard never removes by accident.
            ref={(el: HTMLButtonElement | null) => el?.focus()}
            onClick={() => setAsking(false)}
          >
            Keep
          </Button>
          <Button
            variant="danger"
            icon={Trash2}
            onClick={() => actions.remove(note.id)}
          >
            Remove
          </Button>
        </div>
      </Card>
    );
  if (draft !== null)
    return (
      <div ref={box}>
        <Card pad="sm" className="flex flex-col gap-3">
          <TextField
            label="Your note"
            multiline
            maxLength={1000}
            value={draft}
            onChange={setDraft}
          />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <WhyLine id={why.id} className="w-full">
              {why.why}
            </WhyLine>
            <Button
              variant="quiet"
              onClick={() => {
                setDraft(null);
                why.reset();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                why.press(() => {
                  // An emptied note would be removed: ask first, as Remove does.
                  if (!draft.trim()) setAsking(true);
                  else actions.edit(note.id, draft);
                  setDraft(null);
                })
              }
            >
              Save note
            </Button>
          </div>
        </Card>
      </div>
    );
  return (
    <Card pad="sm" className="flex items-start gap-3">
      {person && <Avatar person={person} size="sm" decorative />}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
        <p className="text-nx-2 font-semibold text-nx-ink">
          {mine ? 'You' : person?.name}
        </p>
        <p className="text-nx-body whitespace-pre-line [overflow-wrap:anywhere] text-nx-ink">
          {note.text}
        </p>
      </div>
      {mine && (
        <div className="-my-1 -mr-1 flex">
          <IconButton
            icon={PencilLine}
            label="Change note"
            plain
            onClick={() => {
              setDraft(note.text);
              // The cursor goes to the end, to carry on writing.
              requestAnimationFrame(() => {
                const field = box.current?.querySelector('textarea');
                field?.focus();
                field?.setSelectionRange(note.text.length, note.text.length);
              });
            }}
          />
          <IconButton
            icon={Trash2}
            label="Remove note"
            plain
            onClick={() => setAsking(true)}
          />
        </div>
      )}
    </Card>
  );
}

/** Notes as a list that grows and shrinks smoothly. With none it shows nothing: Add a note says what to do. */
export function NoteList({
  notes,
  actions,
}: {
  notes: JournalNote[];
  actions: NoteActions;
}) {
  return (
    <div className="relative flex flex-col gap-2">
      <Presence mode="popLayout" initial={false}>
        {notes.map((n) => (
          <Item key={n.id}>
            <NoteItem note={n} actions={actions} />
          </Item>
        ))}
      </Presence>
    </div>
  );
}

/**
 * The day's journal as a section on the page; "Add a note" opens a field right under the notes. The
 * day is in the page's title (and in JournalSheet's), so the journal doesn't name it again.
 */
export function DayJournal({
  day,
  index = 0,
  title = 'Journal',
}: {
  day: DateString;
  index?: number;
  title?: string;
}) {
  const { notes, add, ...actions } = useNotes(day);
  const partner = useWorld().partner.name;
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const why = useWhy(text.trim() ? null : EMPTY_NOTE, box);
  const start = () => {
    setWriting(true);
    requestAnimationFrame(() =>
      box.current?.querySelector('textarea')?.focus(),
    );
  };
  const stop = () => {
    setWriting(false);
    setText('');
    why.reset();
  };
  return (
    <Section
      title={title}
      index={index}
      action={
        !writing && (
          <Button variant="quiet" icon={Plus} onClick={start}>
            Add a note
          </Button>
        )
      }
    >
      <NoteList notes={notes} actions={actions} />
      {writing && (
        <div ref={box}>
          <Card className="nx-enter flex flex-col gap-3">
            <TextField
              label="New note"
              multiline
              maxLength={1000}
              value={text}
              onChange={setText}
              hint={`${partner} can read it.`}
            />
            <div className="flex flex-wrap items-center justify-end gap-2">
              <WhyLine id={why.id} className="w-full">
                {why.why}
              </WhyLine>
              <Button variant="quiet" onClick={stop}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  why.press(() => {
                    if (add(text)) stop();
                  })
                }
              >
                Add note
              </Button>
            </div>
          </Card>
        </div>
      )}
    </Section>
  );
}

/** The day's journal in a sheet (for a page that keeps only the question on screen). */
export function JournalSheet({
  day,
  open,
  onOpenChange,
}: {
  day: DateString;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { notes, add, ...actions } = useNotes(day);
  const partner = useWorld().partner.name;
  const [text, setText] = useState('');
  // Add note stays filled like Check in's Save; pressed with nothing written, it says so.
  const box = useRef<HTMLDivElement>(null);
  const why = useWhy(text.trim() ? null : EMPTY_NOTE, box);
  const close = (next: boolean) => {
    if (!next) why.reset();
    onOpenChange(next);
  };
  return (
    <Sheet
      open={open}
      onOpenChange={close}
      title={`${formatWeekday(day)}’s journal`}
      description={`${partner} can read it.`}
      footer={
        <>
          <Button onClick={() => close(false)}>Close</Button>
          <Button
            variant="primary"
            onClick={() =>
              why.press(() => {
                if (add(text)) setText('');
              })
            }
          >
            Add note
          </Button>
          {/* Next to the button, like Save's: above it on phones, to its left from 640px. */}
          <WhyLine
            id={why.id}
            className="text-center sm:order-first sm:mr-auto sm:self-center sm:text-left"
          >
            {why.why}
          </WhyLine>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <NoteList notes={notes} actions={actions} />
        <div ref={box}>
          <TextField
            label="New note"
            multiline
            maxLength={1000}
            value={text}
            onChange={setText}
          />
        </div>
      </div>
    </Sheet>
  );
}
