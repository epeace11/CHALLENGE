// Version 1's pieces: today's sessions, the past days as tiles, and the sheets they open.
'use client';
import { useState, type CSSProperties, type Ref } from 'react';
import { ChevronRight, Trash2 } from 'lucide-react';
import type { DateString, Instant, Rule, TimerSession } from '@/lib/next/model';
import { useNav } from '@/components/next/nav';
import {
  Button,
  DayIcon,
  DURATION,
  EASE,
  motion,
  Presence,
  Sheet,
  StatusPill,
  Toggle,
  useReducedMotion,
  type DayTone,
} from '@/components/next/ui';
import {
  canTime,
  entryPill,
  formatDay,
  formatDayShort,
  formatMinutes,
  formatTarget,
  formatTime,
  formatValue,
  formatWeekday,
  isClosed,
  rulesFor,
  type PillStatus,
} from '@/lib/next/selectors';
import { cn } from '@/lib/utils';
import type { TimerFlow } from './use-timer';
import styles from './v1.module.css';

/** "Arabic" from "Arabic, 20 min": the rule's name without its target. */
export const shortTitle = (rule: Rule) => rule.title.split(',')[0];

/** "7:10 – 7:22 am"; "11:50 am – 12:10 pm" across noon; "7:30 pm" when both are the same minute. */
export function timeRange(from: Instant, to: Instant, timeZone: string) {
  const a = formatTime(from, timeZone),
    b = formatTime(to, timeZone);
  if (a === b) return a;
  const [ta, sa] = a.split(' '),
    [tb, sb] = b.split(' ');
  return sa === sb ? `${ta} – ${tb} ${sb}` : `${a} – ${b}`;
}

/** A session's length: "40 sec" under a minute, else whole minutes ("12 min", "1 h 5 min"). */
export const lengthOf = (seconds: number) =>
  seconds < 60
    ? `${Math.max(1, Math.round(seconds))} sec`
    : formatMinutes(seconds);

/* ── Today's sessions ─────────────────────────────────────────────────── */

/**
 * Today's finished sessions, oldest first, as chips: when each started and how long it ran. A tap
 * opens the session, where one timed by mistake can be removed. A session saved by Stop pops in
 * and a removed one leaves (as the kit's Item does, but as list items).
 */
export function SessionChips({
  t,
  onOpen,
  ref,
}: {
  t: TimerFlow;
  onOpen: (session: TimerSession) => void;
  ref?: Ref<HTMLUListElement>;
}) {
  const tz = t.world.challenge.timeZone;
  const still = useReducedMotion();
  return (
    <ul ref={ref} className="flex flex-wrap gap-2">
      <Presence mode="popLayout" initial={false}>
        {t.sessions.map((s) => (
          <motion.li
            key={s.id}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{
              opacity: 0,
              scale: 0.9,
              transition: { duration: still ? 0 : DURATION.fast },
            }}
            transition={{ duration: still ? 0 : DURATION.base, ease: EASE }}
          >
            <button
              type="button"
              className={cn(styles.session, 'nx-press')}
              aria-haspopup="dialog"
              aria-label={`${timeRange(s.startedAt, s.endedAt, tz)}, ${lengthOf(s.seconds)}`}
              onClick={() => onOpen(s)}
            >
              <span className="text-nx-ink-2">
                {formatTime(s.startedAt, tz)}
              </span>
              <span className="font-semibold tabular-nums">
                {lengthOf(s.seconds)}
              </span>
            </button>
          </motion.li>
        ))}
      </Presence>
    </ul>
  );
}

/**
 * The last non-null value, so a sheet keeps showing what it showed while it slides away (its
 * content goes null the moment it starts closing).
 */
function useKept<T>(value: T | null) {
  const [kept, setKept] = useState(value);
  if (value !== null && value !== kept) setKept(value);
  return value ?? kept;
}

/**
 * One of today's sessions: when it ran, and Remove for one timed by mistake. It leaves the page at
 * once (no pop-up after), and focus goes to `afterRemove()`, since the chip that opened it is gone.
 */
export function SessionSheet({
  t,
  session: open,
  onClose,
  afterRemove,
}: {
  t: TimerFlow;
  session: TimerSession | null;
  onClose: () => void;
  afterRemove: () => HTMLElement | null;
}) {
  const tz = t.world.challenge.timeZone;
  const session = useKept(open);
  /** The session just removed: its sheet's close sends focus to `afterRemove()`. */
  const [removed, setRemoved] = useState<string | null>(null);
  return (
    <Sheet
      open={!!open}
      onOpenChange={(o) => {
        if (o) return;
        onClose();
      }}
      finalFocus={() =>
        session && removed === session.id ? afterRemove() : null
      }
      title={
        session ? timeRange(session.startedAt, session.endedAt, tz) : 'Session'
      }
      description={
        session && t.rule
          ? `${lengthOf(session.seconds)} of ${shortTitle(t.rule)}`
          : undefined
      }
      footer={
        session && (
          <Button
            variant="danger"
            icon={Trash2}
            onClick={() => {
              setRemoved(session.id);
              t.remove(session.id);
              onClose();
            }}
          >
            Remove session
          </Button>
        )
      }
    >
      <p className="text-nx-body text-nx-ink-2">
        Timed by mistake? Removing it takes it off today’s total.
      </p>
    </Sheet>
  );
}

/* ── Past days ────────────────────────────────────────────────────────── */

/** Each answer's status as a day square: its colour and its icon. */
const TONE: Record<PillStatus, DayTone> = {
  done: 'done',
  missed: 'missed',
  review: 'review',
  disputed: 'disputed',
  forgiven: 'excused',
  none: 'none',
  open: 'open',
};

type Day = TimerFlow['history'][number];

/**
 * What counts for a past day: the answer saved (by the timer or by hand), else the time timed;
 * null when there is neither yet.
 */
const minutesOf = (d: Day) =>
  d.entry?.value ?? (d.seconds > 0 ? Math.floor(d.seconds / 60) : null);

/** A past day's minutes in words: "30 min", or "nothing yet". */
const minutesText = (rule: Rule, d: Day) => {
  const n = minutesOf(d);
  return n === null ? 'nothing yet' : formatValue(rule, n);
};

/** A day's answer as a pill: "Waiting for review" names who it waits for. */
function pillOf(t: TimerFlow, rule: Rule, d: Day) {
  const pill = entryPill(t.world, rule, d.entry ?? undefined, d.day);
  return {
    status: pill.status,
    label:
      pill.label === 'Waiting for review'
        ? `Waiting for ${t.world.partner.name}`
        : pill.label,
  };
}

/**
 * The past days, oldest first, one tile each: the weekday, the minutes that count, and the answer's
 * colour and icon. A tile opens that day's sessions.
 */
export function PastDays({
  t,
  rule,
  days,
  onOpen,
}: {
  t: TimerFlow;
  rule: Rule;
  days: Day[];
  onOpen: (day: DateString) => void;
}) {
  return (
    <ul className={styles.days}>
      {days.map((d, i) => {
        const pill = pillOf(t, rule, d);
        const tone = TONE[pill.status];
        return (
          <li
            key={d.day}
            className="nx-enter flex min-w-0"
            style={{ ['--nx-i' as string]: i + 2 } as CSSProperties}
          >
            <button
              type="button"
              className={cn(styles.tile, 'nx-press')}
              aria-haspopup="dialog"
              aria-label={`${formatDay(d.day)}: ${minutesText(rule, d)}, ${pill.label}`}
              onClick={() => onOpen(d.day)}
            >
              <span
                className={cn(
                  'nx-day flex flex-col items-center justify-center',
                  styles.square,
                )}
                data-tone={tone}
              >
                <span className="tabular-nums">{minutesOf(d) ?? '–'}</span>
                <DayIcon tone={tone} size={14} />
              </span>
              <span aria-hidden="true">{formatWeekday(d.day).slice(0, 3)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * One past day: its answer and how it was saved, then each session. While the day can still be
 * changed, Check in is one tap away. With `back`, it was opened from every day.
 */
export function DaySheet({
  t,
  rule,
  day: shownDay,
  onClose,
  back,
}: {
  t: TimerFlow;
  rule: Rule;
  day: Day | null;
  onClose: () => void;
  back?: { label: string; onClick: () => void };
}) {
  const { navigate } = useNav();
  const isOpen = !!shownDay;
  const day = useKept(shownDay);
  const tz = t.world.challenge.timeZone;
  const pill = day ? pillOf(t, rule, day) : null;
  const open = !!day && !isClosed(t.world.challenge, day.day, t.world.now);
  const timed = day ? formatMinutes(day.seconds) : '';
  const how = !day?.entry
    ? day && day.sessions.length
      ? `${timed} timed, not saved yet`
      : 'Nothing timed or logged'
    : day.entry.fromTimer
      ? `${minutesText(rule, day)}, saved by itself from the timer`
      : day.sessions.length
        ? `${minutesText(rule, day)}, changed by hand (${timed} timed)`
        : `${minutesText(rule, day)}, logged by hand`;
  return (
    <Sheet
      open={isOpen}
      onOpenChange={(o) => !o && onClose()}
      title={day ? formatDay(day.day) : 'Day'}
      back={back}
      footer={
        open && (
          <Button variant="primary" onClick={() => navigate('log')}>
            {day?.entry ? 'Change on Check in' : 'Log on Check in'}
          </Button>
        )
      }
    >
      {day && pill && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-start gap-2">
            <StatusPill status={pill.status} label={pill.label} />
            <p className="text-nx-body text-nx-ink">{how}</p>
          </div>
          {day.sessions.length > 0 && (
            <ul className="flex flex-col divide-y divide-nx-line border-y border-nx-line">
              {day.sessions.map((s) => (
                <li
                  key={s.id}
                  className="flex min-h-12 items-center gap-3 py-2.5"
                >
                  <span className="min-w-0 flex-1 text-nx-body text-nx-ink-2">
                    {timeRange(s.startedAt, s.endedAt, tz)}
                  </span>
                  <span className="shrink-0 text-nx-body font-semibold text-nx-ink tabular-nums">
                    {lengthOf(s.seconds)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Sheet>
  );
}

/** Every past day, when there are more than the page shows: a row each (a long list may scroll). */
export function AllDaysSheet({
  t,
  rule,
  days,
  open,
  onOpenChange,
  onPick,
}: {
  t: TimerFlow;
  rule: Rule;
  days: Day[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (day: DateString) => void;
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Every day of ${shortTitle(rule)}`}
    >
      <ul className="flex flex-col divide-y divide-nx-line">
        {days.map((d) => {
          const pill = pillOf(t, rule, d);
          const tone = TONE[pill.status];
          return (
            <li key={d.day}>
              <button
                type="button"
                className="nx-press flex min-h-14 w-full items-center gap-3 py-2 text-left"
                aria-label={`${formatDay(d.day)}: ${minutesText(rule, d)}, ${pill.label}`}
                onClick={() => onPick(d.day)}
              >
                <span className="nx-day size-9 shrink-0" data-tone={tone}>
                  <DayIcon tone={tone} size={16} />
                </span>
                <span className="min-w-0 flex-1 text-nx-body text-nx-ink">
                  {formatDayShort(d.day)}
                </span>
                <span className="shrink-0 text-nx-body font-semibold tabular-nums">
                  {minutesOf(d) === null ? '–' : minutesText(rule, d)}
                </span>
                <ChevronRight
                  size={20}
                  aria-hidden="true"
                  className="shrink-0 text-nx-accent"
                />
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

/* ── How it works, and which rules have the timer ─────────────────────── */

/**
 * How the timer turns into answers, and a switch for each rule counted in minutes. Either person
 * can turn it on or off at any time; turning it off saves a timer going on that rule.
 */
export function HowSheet({
  t,
  open,
  onOpenChange,
}: {
  t: TimerFlow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { world } = t;
  const partner = world.partner.name;
  const minuteRules = rulesFor(world.challenge, world.me.id).filter(canTime);
  const shared = minuteRules.some((r) => r.who === 'both');
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="How the timer works">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2 text-nx-body text-nx-ink">
          <p>Each day’s sessions add up, and time past your target counts.</p>
          <p>
            At midnight, the day’s total is saved as your answer, in whole
            minutes (19:59 is 19 min). {partner} reviews it and sees each
            session. You can still change it on Check in.
          </p>
        </div>
        {minuteRules.length > 0 && (
          <div className="flex flex-col">
            <h3 className="text-nx-body font-semibold text-nx-ink">Timer on</h3>
            {shared && (
              <p className="text-nx-2 text-nx-ink-2">
                For both of you. It doesn’t change what counts.
              </p>
            )}
            <div className="mt-1 flex flex-col divide-y divide-nx-line">
              {minuteRules.map((r) => (
                <Toggle
                  key={r.id}
                  checked={!!r.timed}
                  onChange={(on) => t.setTimed(r.id, on)}
                  label={shortTitle(r)}
                  description={r.target ? formatTarget(r.target) : undefined}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
