// The Check in page every version shares; a version passes only its end of the day and its actions.
'use client';
import {
  useCallback,
  useId,
  useRef,
  useState,
  type ComponentType,
  type Ref,
} from 'react';
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheckBig,
  NotebookPen,
} from 'lucide-react';
import { AppFrame } from '@/components/next/frames';
import { useNav } from '@/components/next/nav';
import {
  ActionBar,
  Button,
  CountUp,
  EmptyState,
  GlassCard,
  Glide,
  IconButton,
} from '@/components/next/ui';
import type { Rule } from '@/lib/next/model';
import {
  answerLine,
  formatDate,
  formatDay,
  formatWeekday,
  lastDay,
} from '@/lib/next/selectors';
import { cn } from '@/lib/utils';
import { Bar } from './bar';
import { ClosedDay } from './closed-day';
import { DayListSheet, DaySheet } from './days';
import { JournalSheet } from './journal';
import { QuestionFields, QuestionHead, SaveHint } from './question';
import { useCheckin, type Checkin } from './use-checkin';
import styles from './log.module.css';

/** What a version's end of the day gets: the day, and the way to its answers sheet. */
export type EndActionsProps = {
  ci: Checkin;
  /** Opens the day's answers (tap one to change it). */
  showAnswers: () => void;
};

export type EndProps = EndActionsProps & {
  /** The end's heading (with tabIndex -1): focus moves to it after the last Save. */
  headingRef: Ref<HTMLHeadingElement>;
};

/**
 * One question at a time in large type, Save and Skip pinned at the bottom, the day chip, the
 * progress button and the journal on top. Once every check-in of the open day is answered, `end`
 * fills the question area and `endActions` the action bar; that is all the versions change.
 */
export function CheckinPage({
  end: End,
  endActions: EndActions,
}: {
  end: ComponentType<EndProps>;
  endActions: ComponentType<EndActionsProps>;
}) {
  const top = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  // A card gliding away unmounts after the next one mounts; keep pointing at the newest heading.
  const placeHeading = useCallback((el: HTMLHeadingElement | null) => {
    if (el) heading.current = el;
  }, []);
  const ci = useCheckin({ top, heading });
  const { navigate } = useNav();
  const [days, setDays] = useState(false);
  const [list, setList] = useState(false);
  const [journal, setJournal] = useState(false);
  const { day, current: rule } = ci;
  const showAnswers = useCallback(() => setList(true), []);

  if (!day)
    return (
      <AppFrame>
        <GlassCard pad="lg" className="mt-4">
          <EmptyState
            icon={CircleCheckBig}
            title="Nothing to check in"
            action={
              <Button variant="primary" onClick={() => navigate('overview')}>
                Go to Overview
              </Button>
            }
          >
            {/* Before Day 1 and on it, say when the first answer is due; later, the next day. */}
            {ci.world.today < ci.world.challenge.start
              ? `Day 1 is ${formatDay(ci.world.challenge.start)}. ${answerLine(ci.world, ci.world.challenge.start)}`
              : ci.world.today === ci.world.challenge.start
                ? answerLine(ci.world, ci.world.today)
                : ci.world.today > lastDay(ci.world.challenge)
                  ? 'That was the last day.'
                  : 'The next day opens at midnight.'}
          </EmptyState>
        </GlassCard>
      </AppFrame>
    );

  return (
    <AppFrame>
      {ci.late ? (
        <ClosedDay ci={ci} onDays={() => setDays(true)} />
      ) : (
        <div className="flex flex-col gap-5">
          {/* The date lives in the day switcher; the page still has a title for screen readers. */}
          <h1 className="sr-only">Check in for {formatDay(day)}</h1>
          {/* The day, what's left of it (opens the answers so far) and its journal on one row, with
              the progress bar and the time left under it: no card of their own above the question. */}
          <div className="nx-enter flex flex-col gap-2 pt-1 sm:pt-2">
            {/* The day is never cut off: shorter under 360px ("Thu 19"), and at 150% zoom the rest wraps under it. */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={cn(styles.chip, styles.chipRow, 'nx-press')}
                aria-haspopup="dialog"
                onClick={() => setDays(true)}
              >
                <CalendarDays
                  size={20}
                  aria-hidden="true"
                  className="shrink-0 text-nx-accent"
                />
                <span className={cn(styles.chipTitle, 'whitespace-nowrap')}>
                  <span className="hidden max-[359px]:inline">
                    {formatWeekday(day).slice(0, 3)} {Number(day.slice(8))}
                  </span>
                  <span className="max-[359px]:hidden sm:hidden">
                    {formatWeekday(day).slice(0, 3)}, {formatDate(day)}
                  </span>
                  <span className="hidden sm:inline">{formatDay(day)}</span>
                </span>
                <ChevronDown
                  size={18}
                  aria-hidden="true"
                  className="shrink-0 text-nx-accent"
                />
              </button>
              {rule && (
                <button
                  type="button"
                  className={cn(styles.left, 'nx-press ml-auto')}
                  aria-haspopup="dialog"
                  aria-label={
                    ci.left > 0
                      ? `${ci.left} left, ${ci.timeLeftLabel} to go: see your answers`
                      : 'All answered: see your answers'
                  }
                  onClick={showAnswers}
                >
                  {ci.left > 0 ? (
                    <>
                      <CountUp value={ci.left} /> left
                    </>
                  ) : (
                    'All answered'
                  )}
                  <ChevronRight
                    size={20}
                    aria-hidden="true"
                    className="shrink-0 text-nx-accent"
                  />
                </button>
              )}
              <IconButton
                icon={NotebookPen}
                label={`${formatWeekday(day)}’s journal`}
                aria-haspopup="dialog"
                className={rule ? undefined : 'ml-auto'}
                onClick={() => setJournal(true)}
              />
            </div>
            {/* At the end of the day the squares below show every answer, so the bar would repeat them. */}
            {rule && (
              <div className="flex items-center gap-3">
                <Bar
                  value={ci.answered}
                  max={ci.due}
                  segments
                  size="sm"
                  tone={ci.left > 0 ? 'accent' : 'done'}
                  className="min-w-0 flex-1"
                />
                {ci.left > 0 && (
                  <span className="shrink-0 text-nx-2 text-nx-ink-2">
                    {ci.timeLeftLabel} to go
                  </span>
                )}
              </div>
            )}
          </div>

          <div ref={top} className={cn(styles.anchor, styles.clipX)}>
            <Glide
              id={rule ? `${day}|${rule.id}` : `${day}|done`}
              direction={ci.direction}
            >
              {rule ? (
                <Focus ci={ci} rule={rule} headingRef={placeHeading} />
              ) : (
                <End
                  ci={ci}
                  headingRef={placeHeading}
                  showAnswers={showAnswers}
                />
              )}
            </Glide>
          </div>

          {/* The page's gap is space enough above the bar, so a check-in fits on a phone. */}
          <ActionBar className="mt-0" pinned>
            {rule ? (
              <>
                <SaveHint
                  ci={ci}
                  rule={rule}
                  className="text-center sm:order-last sm:mr-auto sm:text-left"
                />
                {/* Side by side even on phones, so the bar stays low and the answer stays in view. */}
                <div className="flex flex-row-reverse items-center gap-2">
                  <Button
                    variant="primary"
                    size="lg"
                    full
                    icon={Check}
                    className="min-w-0 flex-1 sm:w-auto sm:min-w-56 sm:flex-none"
                    onClick={() => ci.trySave(rule)}
                  >
                    Save
                  </Button>
                  {ci.changing ? (
                    <Button onClick={ci.cancel}>Cancel</Button>
                  ) : ci.left > 1 ? (
                    <Button variant="quiet" onClick={() => ci.skip(rule)}>
                      Skip for now
                    </Button>
                  ) : null}
                </div>
              </>
            ) : (
              <EndActions ci={ci} showAnswers={showAnswers} />
            )}
          </ActionBar>
        </div>
      )}
      <DaySheet ci={ci} open={days} onOpenChange={setDays} />
      <DayListSheet ci={ci} open={list} onOpenChange={setList} />
      <JournalSheet day={day} open={journal} onOpenChange={setJournal} />
    </AppFrame>
  );
}

function Focus({
  ci,
  rule,
  headingRef,
}: {
  ci: Checkin;
  rule: Rule;
  headingRef: Ref<HTMLHeadingElement>;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-5 pt-1 sm:gap-6 sm:pt-2 lg:gap-8"
    >
      <div className="flex flex-col gap-2">
        {/* Changing an answer, this line takes the place of the rule's group and days: one line
            above the question, so a miss's card still fits. */}
        {ci.changing && (
          <p className="text-nx-2 font-semibold text-nx-ink-2">
            Changing your saved answer
          </p>
        )}
        <QuestionHead
          rule={rule}
          headingRef={headingRef}
          id={id}
          size="lg"
          eyebrow={!ci.changing}
        />
      </div>
      <QuestionFields ci={ci} rule={rule} />
    </section>
  );
}
