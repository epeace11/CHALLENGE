'use client';
import { useId, useState } from 'react';
import { ChevronRight, Pencil, Plus } from 'lucide-react';
import type { Goal } from '@/lib/next/model';
import {
  Button,
  IconButton,
  DURATION,
  EASE,
  Presence,
  motion,
  useReducedMotion,
} from '@/components/next/ui';
import { GoalsSheet, PartnerGoalsSheet } from './goal-sheets';
import { useGoals } from './use-goals';

/**
 * Keys that follow the words, so a changed goal fades in as itself and the rest stay put (goal ids
 * are their places in the list). The same words twice get their own keys.
 */
function keyed(list: Goal[]) {
  const seen = new Map<string, number>();
  return list.map((g) => {
    const n = seen.get(g.text) ?? 0;
    seen.set(g.text, n + 1);
    return { key: `${n}:${g.text}`, text: g.text };
  });
}

/**
 * Your goals, the first thing under the day's title, as a written list rather than a card: a rounded
 * accent rule down the left, "Your goals" with the partner's goals and Change (a pencil) on its
 * line, then each goal in a larger serif with its number hanging in the accent colour, so it reads
 * like a note to yourself (picked November 11, 2026). With none yet, it holds "Add your goals".
 * It has no filled button: Log yesterday stays the page's one main action. After a save the list
 * shows the change: a new or changed goal fades in, a removed one fades out.
 */
export function GoalsFirst() {
  const goals = useGoals();
  const still = useReducedMotion();
  const title = useId();
  const [editing, setEditing] = useState(false);
  const [theirs, setTheirs] = useState(false);
  const has = goals.mine.length > 0;
  return (
    <section
      aria-labelledby={title}
      className="nx-enter relative flex flex-col gap-2 pl-5 before:absolute before:inset-y-1 before:left-0 before:w-1 before:rounded-full before:bg-nx-accent"
    >
      <div className="-mr-2 flex items-center gap-1">
        <h2
          id={title}
          className="mr-auto font-nx-sans text-nx-2 font-semibold text-nx-accent"
        >
          Your goals
        </h2>
        {goals.hasPartner && (
          <button
            type="button"
            className="nx-press inline-flex min-h-11 items-center gap-0.5 rounded-nx-sm px-2 text-nx-2 font-semibold text-nx-accent hover:bg-nx-surface-2"
            aria-haspopup="dialog"
            onClick={() => setTheirs(true)}
          >
            {goals.partner.name}’s goals
            <ChevronRight size={18} className="shrink-0" aria-hidden />
          </button>
        )}
        {has && (
          <IconButton
            icon={Pencil}
            label="Change your goals"
            plain
            className="text-nx-accent"
            onClick={() => setEditing(true)}
          />
        )}
      </div>

      {has ? (
        <ol className="flex flex-col gap-2">
          <Presence mode="popLayout" initial={false}>
            {keyed(goals.mine).map(({ key, text }, i) => (
              <motion.li
                key={key}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{
                  opacity: 0,
                  scale: 0.96,
                  transition: { duration: still ? 0 : DURATION.fast },
                }}
                transition={{ duration: still ? 0 : DURATION.base, ease: EASE }}
                className="flex gap-3 font-nx-serif text-nx-lead leading-snug text-nx-ink"
              >
                {/* The number hangs, so a goal that wraps lines up under its own words. */}
                <span
                  className="w-5 shrink-0 text-nx-accent tabular-nums"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <span className="min-w-0 break-words text-pretty">{text}</span>
              </motion.li>
            ))}
          </Presence>
        </ol>
      ) : (
        <Button
          variant="secondary"
          icon={Plus}
          className="self-start"
          onClick={() => setEditing(true)}
        >
          Add your goals
        </Button>
      )}

      <GoalsSheet open={editing} onOpenChange={setEditing} goals={goals} />
      {goals.hasPartner && (
        <PartnerGoalsSheet
          open={theirs}
          onOpenChange={setTheirs}
          name={goals.partner.name}
          goals={goals.theirs}
        />
      )}
    </section>
  );
}
