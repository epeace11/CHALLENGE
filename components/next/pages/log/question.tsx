'use client';
import { useId, useRef, type ReactNode, type Ref } from 'react';
import { ChevronRight, Gift, NotebookPen, type LucideIcon } from 'lucide-react';
import type { Rule } from '@/lib/next/model';
import {
  countsForWeek,
  formatMoney,
  formatWeekday,
  formatWhen,
  nextMissCost,
  pointOfEntry,
  weekProgress,
} from '@/lib/next/selectors';
import { useNav } from '@/components/next/nav';
import {
  Button,
  Card,
  NumberField,
  ProofStrip,
  TextField,
  Toggle,
  YesNo,
} from '@/components/next/ui';
import { cn } from '@/lib/utils';
import { Bar } from './bar';
import {
  fieldControls,
  outcomeOf,
  stepFor,
  unitLabel,
  type Checkin,
} from './use-checkin';
import { useDescribedBy, WhyLine } from './why';
import styles from './log.module.css';

/** A line of text that is one button: it wraps on phones, unlike a kit Button, and leads somewhere. */
export function LinkLine({
  icon: Icon,
  children,
  onClick,
  tone = 'accent',
  className,
}: {
  icon?: LucideIcon;
  children: ReactNode;
  onClick: () => void;
  tone?: 'accent' | 'missed' | 'done';
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(styles.link, 'nx-press', className)}
      data-tone={tone}
    >
      {Icon && <Icon size={20} aria-hidden="true" className="shrink-0" />}
      <span className="min-w-0 flex-1 font-semibold">{children}</span>
      <ChevronRight size={18} aria-hidden="true" className="shrink-0" />
    </button>
  );
}

/**
 * The rule's group and when it is asked, above the question: "Screens · Every day". A weekly rule
 * shows only its group: its week card ("2 of 4 this week") already says how many days.
 */
export function Eyebrow({ rule }: { rule: Rule }) {
  return (
    <p className="text-nx-2 font-semibold text-nx-accent">
      {rule.group}
      {rule.kind !== 'weekly' && ` · ${formatWhen(rule)}`}
    </p>
  );
}

/** The question as asked, in Georgia, and what counts. `size="lg"` for a full-screen card (larger on laptops). */
export function QuestionHead({
  rule,
  headingRef,
  size = 'md',
  id,
  eyebrow = true,
}: {
  rule: Rule;
  headingRef?: Ref<HTMLHeadingElement>;
  size?: 'md' | 'lg';
  id?: string;
  /** The group and days above the question; off where the rule's name is already shown. */
  eyebrow?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      {eyebrow && <Eyebrow rule={rule} />}
      <h2
        ref={headingRef}
        id={id}
        tabIndex={-1}
        className={cn(
          'font-nx-serif text-nx-ink outline-none',
          size === 'lg' ? 'text-nx-h2 lg:text-nx-h1' : 'text-nx-h2',
        )}
      >
        {rule.question}
      </h2>
      <p
        className={cn(
          'text-nx-ink-2',
          size === 'lg' ? 'text-nx-body lg:text-nx-lead' : 'text-nx-body',
        )}
      >
        {rule.description}
      </p>
    </div>
  );
}

/**
 * Everything one check-in asks, as a draft until Save: Yes or No or a number (pass or fail shown
 * as you type), the week so far for weekly rules, screenshots, a note, and with a miss what it
 * costs and "Ask Jordan to forgive this".
 */
export function QuestionFields({
  ci,
  rule,
  className,
}: {
  ci: Checkin;
  rule: Rule;
  className?: string;
}) {
  const { navigate } = useNav();
  const { world, me, partner, day, late } = ci;
  const reasonBox = useRef<HTMLDivElement>(null),
    noteBox = useRef<HTMLDivElement>(null);
  /** Moves focus into a field that just opened (the reason or the note). */
  const focusIn = (box: typeof noteBox) =>
    requestAnimationFrame(() =>
      box.current?.querySelector('textarea')?.focus(),
    );
  const draft = ci.draftOf(rule),
    outcome = outcomeOf(rule, draft),
    entry = ci.entryOf(rule);
  const hasPoint = !!entry && !!pointOfEntry(world, entry.id);
  const week =
    rule.kind === 'weekly' && day
      ? weekProgress(world, me, rule.id, day)
      : null;
  const counted = !!entry && countsForWeek(entry);
  const have = week
    ? week.have - (counted ? 1 : 0) + (draft.done === true ? 1 : 0)
    : 0;
  const more = week ? Math.max(0, week.need - have) : 0;
  const shots = draft.proofs.length;
  /** The miss card can show here: a late answer never asks to forgive, and a weekly No costs nothing. */
  const canMiss = !late && rule.kind !== 'weekly';
  const missed = canMiss && outcome === 'miss';
  /** What goes with the answer: its screenshot, the week so far, what a miss costs. */
  const side = rule.proof !== 'none' || !!week || missed;
  /** Two columns from 640px whenever the right one can have something in it. */
  const columns = rule.proof !== 'none' || !!week || canMiss;

  // Save brings a missing part into view and focuses it (see revealField in use-checkin.ts).
  const field = (name: 'answer' | 'proof' | 'reason') => ({
    'data-field': name,
    'data-rule': rule.id,
  });

  return (
    // From 640px the answer and its note sit on the left and what goes with the answer on the right,
    // so the form fits a short laptop window. Where a miss's card can appear, the right side is kept
    // even while empty, so the card appears beside the answer instead of moving it.
    <div
      className={cn(
        'flex flex-col gap-5',
        columns && 'sm:grid sm:grid-cols-2 sm:grid-rows-[auto_1fr] sm:gap-x-6',
        className,
      )}
    >
      <div {...field('answer')} className="sm:col-start-1 sm:row-start-1">
        {rule.kind === 'number' ? (
          <NumberField
            label={unitLabel(rule)}
            value={draft.value}
            onChange={(value) => ci.change(rule, { value })}
            target={rule.target}
            step={stepFor(rule)}
            decimals={stepFor(rule) < 1}
          />
        ) : (
          <YesNo
            label={rule.question}
            value={draft.done}
            onChange={(done) => ci.change(rule, { done })}
          />
        )}
      </div>

      {side && (
        <div className="flex flex-col gap-5 sm:col-start-2 sm:row-span-2 sm:row-start-1">
          {rule.proof !== 'none' && (
            <div {...field('proof')} className="flex flex-col gap-2.5">
              {/* Once a screenshot is added, the thumbnail says so: no status beside the label, and
                  on phones no label either, so the form still fits. */}
              <p
                className={cn(
                  'items-baseline justify-between gap-3',
                  shots ? 'hidden sm:flex' : 'flex',
                )}
              >
                <span className="text-nx-2 font-semibold text-nx-ink">
                  Screenshot
                </span>
                {shots === 0 && (
                  <span
                    className={cn(
                      'text-nx-2',
                      rule.proof === 'required' && outcome !== 'miss'
                        ? 'font-semibold text-nx-wait'
                        : 'text-nx-ink-2',
                    )}
                  >
                    {rule.proof === 'required' && outcome !== 'miss'
                      ? 'Required'
                      : 'Optional'}
                  </span>
                )}
              </p>
              <ProofStrip
                proofs={draft.proofs}
                onAdd={() => ci.addProof(rule)}
                onRemove={(id) => ci.removeProof(rule, id)}
              />
            </div>
          )}

          {week && (
            <button
              type="button"
              className={cn(styles.week, 'nx-press')}
              onClick={() => navigate('progress')}
            >
              <span className="flex items-center gap-3">
                <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span className="text-nx-body font-semibold text-nx-ink">
                    {have} of {week.need} this week
                  </span>
                  <span className="text-nx-2 text-nx-ink-2">
                    {more > 0
                      ? `${more} more by ${formatWeekday(week.week.end)}`
                      : 'Done for this week'}
                  </span>
                </span>
                <ChevronRight
                  size={20}
                  aria-hidden="true"
                  className="shrink-0 text-nx-accent"
                />
              </span>
              <Bar value={have} max={week.need} segments tone="done" />
            </button>
          )}

          {missed && (
            <Card pad="sm" className="nx-enter flex flex-col gap-1">
              {!hasPoint && (
                <LinkLine
                  icon={Gift}
                  tone="missed"
                  className="-mx-2 w-[calc(100%+16px)]"
                  onClick={() => navigate('gifts')}
                >
                  {/* The toggle under it names the partner, so this line doesn't. */}
                  A miss adds {formatMoney(nextMissCost(world, me))} to the gift
                  you give.
                </LinkLine>
              )}
              <Toggle
                checked={draft.forgive}
                onChange={(forgive) => {
                  ci.change(rule, { forgive });
                  if (forgive) focusIn(reasonBox);
                }}
                label={`Ask ${partner} to forgive this`}
                description={`If ${partner} agrees, the point costs nothing.`}
              />
              <div
                ref={reasonBox}
                {...field('reason')}
                className="empty:hidden"
              >
                {draft.forgive && (
                  <TextField
                    className="nx-enter pb-2"
                    // The toggle above asks it; the field only needs a name.
                    label="Your reason"
                    multiline
                    rows={3}
                    maxLength={500}
                    value={draft.reason}
                    onChange={(reason) => ci.change(rule, { reason })}
                  />
                )}
              </div>
            </Card>
          )}
        </div>
      )}

      <div
        ref={noteBox}
        className="flex flex-col sm:col-start-1 sm:row-start-2"
      >
        {draft.noteOpen || draft.note ? (
          <TextField
            className="nx-enter"
            label="Note"
            multiline
            rows={3}
            maxLength={500}
            value={draft.note}
            onChange={(note) => ci.change(rule, { note })}
            hint={`${partner} sees it with your answer.`}
          />
        ) : (
          <Button
            variant="quiet"
            icon={NotebookPen}
            // The button keeps its 44px, reaching into the space above and below it, so its row is
            // only as tall as its words.
            className="-my-3 -ml-3 self-start"
            onClick={() => {
              ci.change(rule, { noteOpen: true });
              focusIn(noteBox);
            }}
          >
            Add a note to this answer
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Why Save can't save, said next to it: at once when the reason is not obvious, and for any
 * reason once Save is pressed. The part of the form it is about (where Save moves focus) is
 * described by it, so a screen reader hears it there too.
 */
export function SaveHint({
  ci,
  rule,
  className,
}: {
  ci: Checkin;
  rule: Rule;
  className?: string;
}) {
  const id = useId();
  const problem = ci.blocked(rule);
  useDescribedBy(id, !!problem, () =>
    problem ? fieldControls(rule.id, problem.field) : [],
  );
  return (
    <WhyLine id={id} className={className}>
      {problem?.text}
    </WhyLine>
  );
}
