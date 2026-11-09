// The clock first: one rule's stopwatch inside a ring that closes at today's target, then today's sessions and past days.
'use client';
import {
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { Check, CircleHelp, Pause, Play, Square, Timer } from 'lucide-react';
import type { DateString, TimerSession } from '@/lib/next/model';
import { AppFrame } from '@/components/next/frames';
import { useNav } from '@/components/next/nav';
import {
  Button,
  EmptyState,
  GlassCard,
  IconButton,
  PageTitle,
  Toggle,
} from '@/components/next/ui';
import {
  appliesOn,
  formatClock,
  formatTarget,
  formatValue,
  formatWeekday,
  ruleById,
  timedProgress,
} from '@/lib/next/selectors';
import { cn } from '@/lib/utils';
import { Dial, min } from './v1-dial';
import {
  AllDaysSheet,
  DaySheet,
  HowSheet,
  PastDays,
  SessionChips,
  SessionSheet,
  shortTitle,
} from './v1-parts';
import { useTimer, type TimerFlow } from './use-timer';
import styles from './v1.module.css';

/** Past days the page shows as tiles; more are one tap away. */
const SHOWN_DAYS = 7;

export default function TimerV1() {
  const t = useTimer();
  const [how, setHow] = useState(false);
  const [session, setSession] = useState<TimerSession | null>(null);
  const [dayOpen, setDayOpen] = useState<{
    day: DateString;
    fromAll?: boolean;
  } | null>(null);
  const [all, setAll] = useState(false);
  const id = useId();
  /** Today's session chips, and the dial's Start (Pause, Resume) button: where focus goes back. */
  const chips = useRef<HTMLUListElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const help = (
    <IconButton
      icon={CircleHelp}
      label="How the timer works"
      aria-haspopup="dialog"
      onClick={() => setHow(true)}
    />
  );

  if (!t.rule || !t.progress)
    return (
      <AppFrame>
        <NoTimedRules
          t={t}
          // The switch turned on goes with this view: focus moves to Start, which takes its place.
          onTurnedOn={() =>
            requestAnimationFrame(() => toggle.current?.focus())
          }
        />
        {/* Turning off the last timer from How the timer works leaves the sheet open over this. */}
        <HowSheet t={t} open={how} onOpenChange={setHow} />
      </AppFrame>
    );

  const rule = t.rule;
  const short = shortTitle(rule);
  const past = t.history.filter((d) => d.day < t.today);
  const shown = past.slice(0, SHOWN_DAYS).reverse();
  const openDay = dayOpen
    ? (t.history.find((d) => d.day === dayOpen.day) ?? null)
    : null;
  // Today's total so far, a session still going included: the whole minutes saved as the answer.
  const timingToday = t.run?.ruleId === rule.id && t.run.day === t.today;
  const todayShown = t.sessions.length > 0 || timingToday;

  return (
    <AppFrame>
      <div className="flex flex-col gap-5">
        {t.rules.length > 1 ? (
          <RuleChips t={t} />
        ) : (
          <PageTitle
            title={
              <>
                <span className="sr-only">Timer: </span>
                {short}
              </>
            }
            action={help}
          />
        )}

        <Clock
          t={t}
          toggleRef={toggle}
          corner={t.rules.length > 1 ? help : undefined}
        />

        {(todayShown || shown.length > 0) && (
          // Side by side from 640px: short things in a row, so a laptop needn't scroll.
          <div
            className="nx-enter flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-8"
            style={{ ['--nx-i' as string]: 2 } as CSSProperties}
          >
            {todayShown && (
              <section
                aria-labelledby={`${id}-today`}
                className="flex min-w-0 flex-col gap-2 sm:flex-1"
              >
                <div className="text-nx-2 text-nx-ink-2">
                  <h2 id={`${id}-today`} className={cn(styles.label, 'inline')}>
                    Today
                  </h2>
                  {' · '}
                  <span className="font-semibold text-nx-ink tabular-nums">
                    {formatValue(rule, t.progress.minutes)} total
                  </span>
                  {t.asksToday && ', saved at midnight'}
                </div>
                {t.sessions.length > 0 && (
                  <SessionChips ref={chips} t={t} onOpen={setSession} />
                )}
              </section>
            )}

            {shown.length > 0 && (
              <section
                aria-labelledby={`${id}-past`}
                className="flex min-w-0 flex-col gap-2 sm:w-[21rem] sm:shrink-0"
              >
                <div className="flex min-h-6 items-center justify-between gap-3">
                  <h2 id={`${id}-past`} className={styles.label}>
                    Past days
                  </h2>
                  {past.length > SHOWN_DAYS && (
                    <Button
                      variant="quiet"
                      aria-haspopup="dialog"
                      className="-my-2.5"
                      onClick={() => setAll(true)}
                    >
                      See all {past.length}
                    </Button>
                  )}
                </div>
                <PastDays
                  t={t}
                  rule={rule}
                  days={shown}
                  onOpen={(day) => setDayOpen({ day })}
                />
              </section>
            )}
          </div>
        )}
      </div>

      <SessionSheet
        t={t}
        session={session}
        onClose={() => setSession(null)}
        afterRemove={() =>
          chips.current?.querySelector('button') ?? toggle.current
        }
      />
      <DaySheet
        t={t}
        rule={rule}
        day={openDay}
        onClose={() => setDayOpen(null)}
        back={
          dayOpen?.fromAll
            ? {
                label: `Every day of ${short}`,
                onClick: () => {
                  setDayOpen(null);
                  setAll(true);
                },
              }
            : undefined
        }
      />
      <AllDaysSheet
        t={t}
        rule={rule}
        days={past}
        open={all}
        onOpenChange={setAll}
        onPick={(day) => {
          setAll(false);
          setDayOpen({ day, fromAll: true });
        }}
      />
      <HowSheet t={t} open={how} onOpenChange={setHow} />
    </AppFrame>
  );
}

/**
 * The hero: the dial (with the session going, or what's left to go, inside it) and the buttons. Start
 * when nothing is going; while it runs, Stop and save (filled) with Pause; while paused, Resume
 * (filled) with Stop and save. Pause and Resume take Start's place, so a quick second tap only
 * pauses, and focus stays on that button.
 */
function Clock({
  t,
  toggleRef: toggle,
  corner,
}: {
  t: TimerFlow;
  toggleRef: RefObject<HTMLButtonElement | null>;
  /** Beside the dial, top right: How the timer works, when the rule chips take the title's place. */
  corner?: ReactNode;
}) {
  const rule = t.rule!;
  const short = shortTitle(rule);
  const me = t.world.me.id;
  const run = t.run;
  /** The timer going, when it is on the rule on screen. */
  const here = run?.ruleId === rule.id ? run : null;
  const state = here ? (here.runningSince ? 'running' : 'paused') : 'idle';
  // A session counts toward the day it started: one still going after midnight shows that day.
  const day = here ? here.day : t.today;
  const p =
    day === t.today
      ? t.progress!
      : timedProgress(t.world, me, rule, day, t.now);
  const asks =
    day === t.today ? t.asksToday : appliesOn(rule, day, t.world.challenge);
  const other =
    run && !here ? (ruleById(t.world.challenge, run.ruleId) ?? null) : null;

  const target = p.target?.value ?? 0;
  const togo =
    !asks || !p.target
      ? null
      : p.limit
        ? target - p.minutes > 0
          ? `${min(target - p.minutes)} left`
          : null
        : p.met
          ? null
          : `${min(Math.ceil((p.targetSeconds - p.seconds) / 60))} to go`;

  const note = !asks
    ? `${short} isn’t asked ${day === t.today ? 'today' : `on ${formatWeekday(day)}`}, so this time won’t be an answer.`
    : day !== t.today
      ? `This session counts toward ${formatWeekday(day)}.`
      : other
        ? `Starting stops your ${shortTitle(other)} timer and saves it.`
        : null;

  return (
    <section
      aria-label={`${short} ${day === t.today ? 'today' : formatWeekday(day)}`}
      className="nx-enter relative flex flex-col items-center gap-4 sm:gap-5"
      style={{ ['--nx-i' as string]: 1 } as CSSProperties}
    >
      {corner && <div className="absolute top-0 right-0">{corner}</div>}
      <Dial
        progress={p}
        state={state}
        label={`${short} ${day === t.today ? 'today' : formatWeekday(day)}`}
        status={
          state === 'idle' ? (
            togo
          ) : (
            <>
              {state === 'running' && (
                <span className={styles.live} aria-hidden="true" />
              )}
              <span className="tabular-nums">
                {state === 'paused' ? 'Paused · session' : 'This session'}{' '}
                {formatClock(t.elapsed)}
              </span>
            </>
          )
        }
      />

      <div className="grid w-full max-w-md grid-cols-2 gap-2">
        {state !== 'idle' && (
          <Button
            key="stop"
            variant={state === 'running' ? 'primary' : 'secondary'}
            size="lg"
            icon={Square}
            className="px-3"
            onClick={() => {
              t.stop();
              requestAnimationFrame(() => toggle.current?.focus());
            }}
          >
            Stop and save
          </Button>
        )}
        <Button
          key="toggle"
          ref={toggle}
          variant={state === 'running' ? 'secondary' : 'primary'}
          size="lg"
          icon={state === 'running' ? Pause : Play}
          className={cn('px-3', state === 'idle' && 'col-span-2')}
          onClick={() =>
            state === 'idle'
              ? t.start(rule.id)
              : state === 'running'
                ? t.pause()
                : t.resume()
          }
        >
          {state === 'idle'
            ? 'Start'
            : state === 'running'
              ? 'Pause'
              : 'Resume'}
        </Button>
      </div>

      {note && (
        <p className="max-w-sm text-center text-nx-2 text-nx-ink-2">{note}</p>
      )}
    </section>
  );
}

/**
 * Several timed rules: a chip each, the one on screen selected (and a check on any at its target
 * today). The chips name the rule, so the page's title is for screen readers only, and How the
 * timer works moves beside the dial. While a timer is going the others are off, with the reason
 * under them: stop first, then time another.
 */
function RuleChips({ t }: { t: TimerFlow }) {
  const name = useId();
  const going = t.run ? t.rules.find((r) => r.id === t.run!.ruleId) : null;
  return (
    <div className="nx-enter flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:pt-2">
      <h1 className="sr-only">Timer</h1>
      <fieldset className="flex min-w-0 flex-wrap gap-2" disabled={!!going}>
        <legend className="sr-only">Rule to time</legend>
        {t.rules.map((r) => {
          const today = t.todayOf(r);
          const reached = !today.limit && today.met;
          return (
            <label
              key={r.id}
              className={styles.chip}
              data-off={(going && going.id !== r.id) || undefined}
            >
              <input
                type="radio"
                name={name}
                className="sr-only"
                checked={r.id === t.rule?.id}
                onChange={() => t.pick(r.id)}
              />
              {reached && <Check size={18} strokeWidth={2.5} aria-hidden />}
              {shortTitle(r)}
              {reached && <span className="sr-only">, target reached</span>}
            </label>
          );
        })}
      </fieldset>
      {going && (
        <p className="text-nx-2 text-nx-ink-2">
          Stop {shortTitle(going)} to time another rule.
        </p>
      )}
    </div>
  );
}

/**
 * No rule has the timer on: a switch for each rule counted in minutes (turning one on brings the
 * clock), or, when there are none, the plain reason and the way to the rules.
 */
function NoTimedRules({
  t,
  onTurnedOn,
}: {
  t: TimerFlow;
  onTurnedOn: () => void;
}) {
  const { navigate } = useNav();
  return (
    <div className="flex flex-col gap-5">
      <PageTitle title="Timer" />
      <GlassCard
        pad="lg"
        className="nx-enter"
        style={{ ['--nx-i' as string]: 1 }}
      >
        {t.timeable.length > 0 ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="font-nx-serif text-nx-h2">
                Turn on the timer for a rule
              </h2>
              <p className="text-nx-body text-nx-ink-2">
                Each day’s time adds up and is saved as that day’s answer.
              </p>
            </div>
            <div className="flex flex-col divide-y divide-nx-line">
              {t.timeable.map((r) => (
                <Toggle
                  key={r.id}
                  checked={false}
                  onChange={(on) => {
                    t.setTimed(r.id, on);
                    if (on) onTurnedOn();
                  }}
                  label={shortTitle(r)}
                  description={r.target ? formatTarget(r.target) : undefined}
                />
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            icon={Timer}
            title="No rules to time"
            action={
              <Button variant="primary" onClick={() => navigate('rules')}>
                See your rules
              </Button>
            }
          >
            Only rules counted in minutes can be timed.
          </EmptyState>
        )}
      </GlassCard>
    </div>
  );
}
