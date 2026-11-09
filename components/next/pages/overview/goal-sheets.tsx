'use client';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Plus, X } from 'lucide-react';
import type { Goal } from '@/lib/next/model';
import { Button, IconButton, Sheet, TextField } from '@/components/next/ui';
import { GOAL_LENGTH, GOALS_MAX } from '@/lib/next/selectors';
import type { GoalsFlow } from './use-goals';

/**
 * Your goals, to add, change or take out: one field each, up to GOALS_MAX, then Save. It opens
 * with what you have (or one empty field), and Save closes it once saved; the page shows the
 * change, with no pop-up. A write that fails in the live app keeps what was typed.
 */
export function GoalsSheet({
  open,
  onOpenChange,
  goals,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goals: GoalsFlow;
}) {
  const [texts, setTexts] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  /** The goal field at `i` (the last one when `i` is past the end). */
  const field = (i: number) => {
    const inputs = list.current?.querySelectorAll('input');
    return inputs?.[Math.min(i, inputs.length - 1)] ?? null;
  };
  // It opens with the first goal's field focused, ready to type.
  const first = useMemo<RefObject<HTMLElement | null>>(
    () => ({
      get current() {
        return list.current?.querySelector('input') ?? null;
      },
    }),
    [],
  );
  /** The field to put the cursor in once the list has changed on screen (after Add or Take out). */
  const focusNext = useRef<number | null>(null);
  const focusField = (i: number) => {
    focusNext.current = i;
  };
  useEffect(() => {
    if (focusNext.current === null) return;
    field(focusNext.current)?.focus();
    focusNext.current = null;
  }, [texts]);
  // Each time it opens, it starts from the goals as saved.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open)
      setTexts(goals.mine.length ? goals.mine.map((g) => g.text) : ['']);
  }
  const change = (i: number, text: string) =>
    setTexts((list) => list.map((t, j) => (j === i ? text : t)));
  const save = async () => {
    setBusy(true);
    const ok = await goals.save(texts);
    setBusy(false);
    if (ok) onOpenChange(false);
  };
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      initialFocus={first}
      title="Your goals"
      description={
        goals.hasPartner
          ? `For this challenge. ${goals.partner.name} can see them too.`
          : 'For this challenge.'
      }
      footer={
        <Button variant="primary" size="lg" full loading={busy} onClick={save}>
          Save
        </Button>
      }
    >
      <div ref={list} className="flex flex-col gap-4">
        {texts.map((text, i) => (
          <div key={i} className="flex items-end gap-2">
            <TextField
              className="min-w-0 flex-1"
              label={`Goal ${i + 1}`}
              value={text}
              onChange={(t) => change(i, t)}
              maxLength={GOAL_LENGTH}
            />
            {texts.length > 1 && (
              <IconButton
                icon={X}
                label={`Take out goal ${i + 1}`}
                onClick={() => {
                  setTexts((all) => all.filter((_, j) => j !== i));
                  focusField(Math.max(0, i - 1));
                }}
              />
            )}
          </div>
        ))}
        {texts.length < GOALS_MAX && (
          <Button
            variant="quiet"
            icon={Plus}
            className="self-start"
            onClick={() => {
              setTexts((all) => [...all, '']);
              focusField(texts.length);
            }}
          >
            Add a goal
          </Button>
        )}
      </div>
    </Sheet>
  );
}

/** The partner's goals, one tap from yours: their words, numbered as yours are on Overview, read only. */
export function PartnerGoalsSheet({
  open,
  onOpenChange,
  name,
  goals,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  goals: Goal[];
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={`${name}’s goals`}>
      {goals.length ? (
        <ol className="flex flex-col gap-2">
          {goals.map((g, i) => (
            <li
              key={g.id}
              className="flex gap-1.5 rounded-nx border border-nx-accent-line bg-nx-accent-soft px-3 py-3 font-nx-serif text-nx-lead leading-snug text-nx-ink"
            >
              {/* Numbered like your own goals on Overview; a wrapped goal lines up under its words. */}
              <span
                className="shrink-0 text-nx-accent tabular-nums"
                aria-hidden
              >
                {i + 1}.
              </span>
              <span className="min-w-0 break-words text-pretty">{g.text}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-nx-body text-nx-ink-2">
          {name} hasn’t added goals yet.
        </p>
      )}
    </Sheet>
  );
}
