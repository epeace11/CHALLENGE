'use client';
import { useId, useRef, useState, type ReactNode, type Ref } from 'react';
import {
  ChevronRight,
  Gift,
  HandHeart,
  ImagePlus,
  NotebookPen,
  Pencil,
  Timer,
  type LucideIcon,
} from 'lucide-react';
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
  ReasonSheet,
  TextField,
  YesNo,
} from '@/components/next/ui';
import { cn } from '@/lib/utils';
import { Bar } from './bar';
import { timedLine, TimedSheet } from './timed';
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
  popup,
  className,
}: {
  icon?: LucideIcon;
  children: ReactNode;
  onClick: () => void;
  tone?: 'accent' | 'missed' | 'done';
  /** It opens a sheet. */
  popup?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup={popup ? 'dialog' : undefined}
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
 * Everything one check-in asks, as a draft until Save (a plain Yes saves on tap): Yes or No or a number (pass or fail shown
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
  const noteBox = useRef<HTMLDivElement>(null),
    missCard = useRef<HTMLDivElement>(null);
  /** The sheet that asks why the miss should be forgiven is open; each opening starts from the reason as it is. */
  const [asking, setAsking] = useState(false);
  /** The sheet with a timed rule's sessions is open. */
  const [timing, setTiming] = useState(false);
  const [opened, setOpened] = useState(0);
  const ask = () => {
    setOpened((n) => n + 1);
    setAsking(true);
  };
  /** Moves focus into the note once it opens. */
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
  /** Where a timed rule's number came from: its sessions, opened in a sheet. */
  const timed = timedLine(ci, rule);
  /** The miss card can show here: a late answer never asks to forgive, and a weekly No costs nothing. */
  const canMiss = !late && rule.kind !== 'weekly';
  const missed = canMiss && outcome === 'miss';
  /**
   * On a miss a screenshot is optional, so until one is added it is a small button beside "Add a
   * note" instead of a tile, and the miss's card fits under the answer.
   */
  const shotButton = rule.proof !== 'none' && shots === 0 && outcome === 'miss';
  /** What goes with the answer: its screenshot, the week so far, what a miss costs. */
  const side = (rule.proof !== 'none' && !shotButton) || !!week || missed;
  /** Two columns from 640px whenever the right one can have something in it. */
  const columns = rule.proof !== 'none' || !!week || canMiss;

  // Save brings a missing part into view and focuses it (see revealField in use-checkin.ts).
  const field = (name: 'answer' | 'proof') => ({
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
          <>
            <NumberField
              label={unitLabel(rule)}
              value={draft.value}
              onChange={(value) => ci.change(rule, { value })}
              target={rule.target}
              step={stepFor(rule)}
              decimals={stepFor(rule) < 1}
            />
            {timed && (
              <>
                <LinkLine
                  icon={Timer}
                  popup
                  className="-mx-3 mt-1 -mb-2 w-[calc(100%+24px)]"
                  onClick={() => setTiming(true)}
                >
                  {timed}
                </LinkLine>
                <TimedSheet
                  ci={ci}
                  rule={rule}
                  open={timing}
                  onOpenChange={setTiming}
                />
              </>
            )}
          </>
        ) : (
          <YesNo
            label={rule.question}
            value={draft.done}
            onChange={(done) => ci.change(rule, { done })}
            onTap={(done) => ci.answer(rule, done)}
          />
        )}
      </div>

      {side && (
        <div className="flex flex-col gap-5 sm:col-start-2 sm:row-span-2 sm:row-start-1">
          {rule.proof !== 'none' && !shotButton && (
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
                // The database takes six at most.
                max={6}
                busy={ci.uploadingFor(rule)}
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
            <div ref={missCard}>
              <Card pad="sm" className="nx-enter flex flex-col gap-1">
                {!draft.forgive ? (
                  <>
                    {!hasPoint && (
                      <LinkLine
                        icon={Gift}
                        tone="missed"
                        className="-mx-2 w-[calc(100%+16px)]"
                        onClick={() => navigate('progress')}
                      >
                        {/* The card says it's a miss and the line under it names the partner. */}
                        Adds {formatMoney(nextMissCost(world, me))} to the gift
                        you give.
                      </LinkLine>
                    )}
                    {/* The reason is asked in a sheet, as on Review; the sheet says what forgiving does. */}
                    <LinkLine
                      icon={HandHeart}
                      popup
                      className="-mx-2 w-[calc(100%+16px)]"
                      onClick={ask}
                    >
                      Ask {partner} to forgive it
                    </LinkLine>
                  </>
                ) : (
                  // Asking: the request takes the cost's place; Don't ask brings the cost back.
                  <div className="nx-enter flex flex-col gap-1.5 py-1">
                    <p className="text-nx-2 font-semibold text-nx-ink">
                      Asking {partner} to forgive it
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="nx-press flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-nx-sm bg-nx-sunken px-3 py-2 text-left"
                        aria-haspopup="dialog"
                        aria-label={`Your reason: ${draft.reason}. Change it`}
                        onClick={ask}
                      >
                        <span className="min-w-0 flex-1 truncate text-nx-2 text-nx-ink">
                          {draft.reason}
                        </span>
                        <Pencil
                          size={18}
                          aria-hidden="true"
                          className="shrink-0 text-nx-accent"
                        />
                      </button>
                      <Button
                        variant="quiet"
                        className="shrink-0 px-3"
                        onClick={() => ci.change(rule, { forgive: false })}
                      >
                        Don’t ask
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}
          <ReasonSheet
            key={`forgive:${day}:${rule.id}:${opened}`}
            open={asking}
            onOpenChange={setAsking}
            title={`Ask ${partner} to forgive it`}
            description={`If ${partner} agrees, the point costs nothing.`}
            label="Your reason"
            initial={draft.reason}
            maxLength={500}
            // Back to the request, now its reason (or still the Ask row, after Cancel).
            finalFocus={() =>
              missCard.current?.querySelector<HTMLElement>(
                '[aria-haspopup="dialog"]',
              ) ?? null
            }
            submit="Add to answer"
            missing="Write your reason first."
            onSubmit={(reason) => {
              ci.change(rule, { forgive: true, reason });
              setAsking(false);
            }}
          />
        </div>
      )}

      <div
        ref={noteBox}
        className="flex flex-col gap-4 sm:col-start-1 sm:row-start-2"
      >
        {/* The buttons keep their 44px, reaching into the space above and below them, so their
            row is only as tall as their words. */}
        {(shotButton || !(draft.noteOpen || draft.note)) && (
          <div className="-my-3 -ml-3 flex flex-wrap">
            {shotButton && (
              <Button
                variant="quiet"
                icon={ImagePlus}
                loading={ci.uploadingFor(rule)}
                onClick={() => ci.addProof(rule)}
              >
                Add screenshot
              </Button>
            )}
            {!(draft.noteOpen || draft.note) && (
              <Button
                variant="quiet"
                icon={NotebookPen}
                onClick={() => {
                  ci.change(rule, { noteOpen: true });
                  focusIn(noteBox);
                }}
              >
                Add a note
              </Button>
            )}
          </div>
        )}
        {(draft.noteOpen || draft.note) && (
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
