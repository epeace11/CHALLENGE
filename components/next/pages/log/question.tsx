'use client';
import { useRef, type ReactNode, type Ref } from 'react';
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
  outcomeOf,
  problemOf,
  stepFor,
  unitLabel,
  type Checkin,
} from './use-checkin';
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

/** The rule's group and when it is asked, above the question: "Screens · Every day". */
export function Eyebrow({ rule }: { rule: Rule }) {
  return (
    <p className="text-nx-2 font-semibold text-nx-accent">
      {rule.group} · {formatWhen(rule)}
    </p>
  );
}

/** The question as asked, in Georgia, and what counts. `size="lg"` for a full-screen card. */
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
          size === 'lg' ? 'text-nx-h2 sm:text-nx-h1' : 'text-nx-h2',
        )}
      >
        {rule.question}
      </h2>
      <p
        className={cn(
          'text-nx-ink-2',
          size === 'lg' ? 'text-nx-body sm:text-nx-lead' : 'text-nx-body',
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

  return (
    <div className={cn('flex flex-col gap-6', className)}>
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

      {rule.proof !== 'none' && (
        <div className="flex flex-col gap-2.5">
          <p className="flex items-baseline justify-between gap-3">
            <span className="text-nx-2 font-semibold text-nx-ink">
              Screenshot
            </span>
            <span
              className={cn(
                'text-nx-2',
                rule.proof === 'required' &&
                  outcome !== 'miss' &&
                  draft.proofs.length === 0
                  ? 'font-semibold text-nx-wait'
                  : 'text-nx-ink-2',
              )}
            >
              {rule.proof === 'required' && outcome !== 'miss'
                ? draft.proofs.length
                  ? 'Added'
                  : 'Required'
                : 'Optional'}
            </span>
          </p>
          <ProofStrip
            proofs={draft.proofs}
            onAdd={() => ci.addProof(rule)}
            onRemove={(id) => ci.removeProof(rule, id)}
          />
        </div>
      )}

      {outcome === 'miss' && !late && (
        <Card pad="sm" className="nx-enter flex flex-col gap-1">
          {!hasPoint && (
            <LinkLine
              icon={Gift}
              tone="missed"
              className="-mx-2 w-[calc(100%+16px)]"
              onClick={() => navigate('gifts')}
            >
              A miss adds {formatMoney(nextMissCost(world, me))} to the gift you
              give {partner}.
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
          <div ref={reasonBox} className="empty:hidden">
            {draft.forgive && (
              <TextField
                className="nx-enter pb-2"
                label={`Why should ${partner} forgive it?`}
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

      <div ref={noteBox}>
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
            className="-ml-3"
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

/** Why Save is off, said next to it (only when the reason is not obvious). */
export function SaveHint({
  ci,
  rule,
  className,
}: {
  ci: Checkin;
  rule: Rule;
  className?: string;
}) {
  const problem = problemOf(rule, ci.draftOf(rule), ci.late);
  if (!problem?.show) return null;
  return (
    <output
      className={cn('block text-nx-2 font-semibold text-nx-wait', className)}
    >
      {problem.text}
    </output>
  );
}
