'use client';
import { useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { DateString, JournalNote } from '@/lib/next/model';
import { addNote, removeNote } from '@/lib/next/actions';
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
  useToast,
} from '@/components/next/ui';
import { useDemo, useWorld } from '@/components/next/world';

/** The day's notes by both people, oldest first, and adding or removing one (with Undo). */
export function useNotes(day: DateString) {
  const world = useWorld();
  const { update, undo } = useDemo();
  const toast = useToast();
  const notes = world.journal
    .filter((n) => n.day === day)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const add = (text: string) => {
    if (!text.trim()) return false;
    update((w) => addNote(w, world.me.id, day, text));
    toast({ text: 'Note added', action: { label: 'Undo', onClick: undo } });
    return true;
  };
  const remove = (id: string) => {
    update((w) => removeNote(w, id));
    toast({ text: 'Note removed', action: { label: 'Undo', onClick: undo } });
  };
  return { notes, add, remove };
}

function NoteItem({
  note,
  onRemove,
}: {
  note: JournalNote;
  onRemove: (id: string) => void;
}) {
  const world = useWorld();
  const person = personById(world, note.personId),
    mine = note.personId === world.me.id;
  return (
    <Card pad="sm" className="flex items-start gap-3">
      {person && <Avatar person={person} size="sm" decorative />}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
        <p className="text-nx-2 font-semibold text-nx-ink">
          {mine ? 'You' : person?.name}
        </p>
        <p className="text-nx-body text-nx-ink">{note.text}</p>
      </div>
      {mine && (
        <IconButton
          icon={Trash2}
          label="Remove note"
          plain
          className="-my-1 -mr-1"
          onClick={() => onRemove(note.id)}
        />
      )}
    </Card>
  );
}

/** Notes as a list that grows and shrinks smoothly. */
export function NoteList({
  notes,
  onRemove,
  empty,
}: {
  notes: JournalNote[];
  onRemove: (id: string) => void;
  empty: string;
}) {
  return (
    <div className="relative flex flex-col gap-2">
      <Presence mode="popLayout" initial={false}>
        {notes.map((n) => (
          <Item key={n.id}>
            <NoteItem note={n} onRemove={onRemove} />
          </Item>
        ))}
      </Presence>
      {notes.length === 0 && (
        <p className="text-nx-body text-nx-ink-2">{empty}</p>
      )}
    </div>
  );
}

/** The day's journal as a section on the page; "Add a note" opens a field right under the notes. */
export function DayJournal({
  day,
  index = 0,
  title = 'Journal',
}: {
  day: DateString;
  index?: number;
  title?: string;
}) {
  const { notes, add, remove } = useNotes(day);
  const partner = useWorld().partner.name;
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const start = () => {
    setWriting(true);
    requestAnimationFrame(() =>
      box.current?.querySelector('textarea')?.focus(),
    );
  };
  const stop = () => {
    setWriting(false);
    setText('');
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
      <NoteList
        notes={notes}
        onRemove={remove}
        empty={`No notes for ${formatWeekday(day)} yet.`}
      />
      {writing && (
        <div ref={box}>
          <Card className="nx-enter flex flex-col gap-3">
            <TextField
              label={`Note for ${formatWeekday(day)}`}
              multiline
              maxLength={1000}
              value={text}
              onChange={setText}
              hint={`${partner} can read it. Notes never change points.`}
            />
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="quiet" onClick={stop}>
                Cancel
              </Button>
              <Button
                disabled={!text.trim()}
                onClick={() => {
                  if (add(text)) stop();
                }}
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
  const { notes, add, remove } = useNotes(day);
  const partner = useWorld().partner.name;
  const [text, setText] = useState('');
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={`${formatWeekday(day)}’s journal`}
      description={`${partner} can read it. Notes never change points.`}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
          <Button
            variant="primary"
            disabled={!text.trim()}
            onClick={() => {
              if (add(text)) setText('');
            }}
          >
            Add note
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <NoteList
          notes={notes}
          onRemove={remove}
          empty={`No notes for ${formatWeekday(day)} yet.`}
        />
        <TextField
          label="New note"
          multiline
          maxLength={1000}
          value={text}
          onChange={setText}
        />
      </div>
    </Sheet>
  );
}
