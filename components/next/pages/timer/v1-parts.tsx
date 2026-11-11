// Version 1's pieces: today's sessions and the sheets they open.
'use client';
import { useState, type Ref } from 'react';
import { Trash2 } from 'lucide-react';
import type { Instant, Rule, TimerSession } from '@/lib/next/model';
import {
  Button,
  DURATION,
  EASE,
  motion,
  Presence,
  Sheet,
  Toggle,
  useReducedMotion,
} from '@/components/next/ui';
import {
  canTime,
  formatMinutes,
  formatTarget,
  formatTime,
  rulesFor,
} from '@/lib/next/selectors';
import { cn } from '@/lib/utils';
import type { TimerFlow } from './use-timer';
import styles from './v1.module.css';

/** "Arabic" from "Arabic, 20 min": the rule's name without its target. */
export const shortTitle = (rule: Rule) => rule.title.split(', ')[0];

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
 * and a removed one leaves (as the kit's Item does, but as list items). One centred row that
 * scrolls sideways when it's full, so many sessions never make the page scroll.
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
    <ul
      ref={ref}
      className="-m-1 flex w-max max-w-[calc(100%+0.5rem)] gap-2 overflow-x-auto p-1"
    >
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
        Removing it takes it off today’s total.
      </p>
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
              <p className="text-nx-2 text-nx-ink-2">For both of you.</p>
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
