'use client';
import { useId, useState } from 'react';
import { ChevronRight, Flag, Pencil, Plus } from 'lucide-react';
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
import { cn } from '@/lib/utils';
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
 * Your goals in a card of their own, the first thing under the day's title: the one tinted card on
 * the page, so the eye goes there first, kept small. One line says what it is, with the partner's
 * goals and Change on its right; under it each goal is a small outlined, numbered card ("1. Run a
 * 10K before New Year"), side by side, in the page's serif. With none yet, the card holds "Add your
 * goals". It has no filled button: Log yesterday stays the page's one main action. After a save the
 * list shows the change: a new or changed goal fades in, a removed one fades out.
 */
export function GoalsFirst() {
  const goals = useGoals();
  const still = useReducedMotion();
  const title = useId();
  const [editing, setEditing] = useState(false);
  const [theirs, setTheirs] = useState(false);
  const count = goals.mine.length;
  const has = count > 0;
  // Side by side, never stacked: one goal fills the row and two sit as a pair. Three or more are set a
  // size down and, on a phone, sit in one row that scrolls sideways (the next card peeks in at the
  // edge, and all of them are in the sheet), so Log yesterday stays on the first screen; from 640px
  // they sit in rows of three (four in pairs).
  const many = count > 2;
  const row =
    count === 1
      ? 'grid grid-cols-1'
      : count === 2
        ? 'grid grid-cols-2'
        : cn(
            '-mx-5 flex snap-x snap-mandatory scroll-px-5 overflow-x-auto px-5 pb-1 sm:mx-0 sm:grid sm:overflow-visible sm:px-0 sm:pb-0',
            count === 4 ? 'sm:grid-cols-2' : 'sm:grid-cols-3',
          );
  return (
    <section
      aria-labelledby={title}
      className="nx-enter flex flex-col gap-2 rounded-nx-lg border border-nx-accent-line bg-nx-accent-soft px-4 pt-1 pb-4 shadow-nx-lift sm:px-5"
    >
      <div className="-mr-2 flex items-center gap-1">
        <h2
          id={title}
          className="mr-auto flex items-center gap-2 font-nx-sans text-nx-2 font-semibold text-nx-accent"
        >
          <Flag size={18} strokeWidth={2.25} aria-hidden />
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
        <ol className={cn('gap-2', row)}>
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
                className={cn(
                  // The size first: a font size after leading-snug would drop it in cn().
                  // 15px on a phone, where two goals share a row, so a long one fits; 17px from 640px.
                  'text-nx-2 sm:text-nx-body',
                  'flex gap-1.5 rounded-nx border border-nx-accent-line px-3 py-2 font-nx-serif leading-snug text-nx-ink',
                  many && 'w-[44%] shrink-0 snap-start sm:w-auto',
                )}
              >
                {/* The number hangs, so a goal that wraps lines up under its own words. */}
                <span
                  className="shrink-0 text-nx-accent tabular-nums"
                  aria-hidden
                >
                  {i + 1}.
                </span>
                <span className="min-w-0 line-clamp-4 break-words text-pretty">
                  {text}
                </span>
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
