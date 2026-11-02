'use client';
import { CalendarDays, Check, ChevronRight } from 'lucide-react';
import type { DateString, DayColor, Rule, World } from '@/lib/next/model';
import {
  dayColor,
  entryPill,
  formatAnswer,
  formatDay,
  formatWeekday,
  isClosed,
  lastDay,
  openCheckins,
  shift,
  type PillStatus,
} from '@/lib/next/selectors';
import { useNav } from '@/components/next/nav';
import { DayIcon, RowButton, Sheet, StatusPill } from '@/components/next/ui';
import { cn } from '@/lib/utils';
import type { Checkin } from './use-checkin';
import styles from './log.module.css';

/** Closed days before today, most recent first: days a late answer can still change. */
export function recentClosedDays(world: World, count = 7): DateString[] {
  const c = world.challenge,
    out: DateString[] = [];
  for (
    let d = shift(world.today, -1);
    d >= c.start && out.length < count;
    d = shift(d, -1)
  )
    if (d <= lastDay(c) && isClosed(c, d, world.now)) out.push(d);
  return out;
}

const DAY_PILL: Record<DayColor, { status: PillStatus; label: string }> = {
  done: { status: 'done', label: 'Done' },
  excused: { status: 'forgiven', label: 'Forgiven' },
  missed: { status: 'missed', label: 'Missed' },
  review: { status: 'review', label: 'Waiting' },
  open: { status: 'open', label: 'Open' },
  ahead: { status: 'none', label: 'Not yet' },
};

/** "3 left" or "All answered" for a day that can still be answered. */
export const leftText = (left: number) =>
  left > 0 ? `${left} left` : 'All answered';

function DayMark({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        'grid size-10 place-items-center rounded-nx-sm',
        on ? 'bg-nx-accent-soft text-nx-accent' : 'bg-nx-sunken text-nx-ink-2',
      )}
    >
      {on ? (
        <Check size={20} strokeWidth={2.4} aria-hidden="true" />
      ) : (
        <CalendarDays size={20} aria-hidden="true" />
      )}
    </span>
  );
}

/**
 * The day switcher: every day that can still be answered (with what is left and until when), and
 * the closed days before it, where a change is a late answer the partner approves.
 */
export function DaySheet({
  ci,
  open,
  onOpenChange,
}: {
  ci: Checkin;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { world, me, partner } = ci;
  const closed = recentClosedDays(world);
  const pick = (d: DateString) => {
    ci.pickDay(d);
    onOpenChange(false);
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Choose a day">
      <div className="flex flex-col gap-5">
        {ci.loggable.length > 0 && (
          <section className="flex flex-col gap-2.5">
            <h3 className="font-nx-sans text-nx-2 font-semibold text-nx-ink-2">
              Still open
            </h3>
            {ci.loggable.map((d) => (
              <RowButton
                key={d}
                glass={false}
                leading={<DayMark on={d === ci.day} />}
                title={formatDay(d)}
                detail={`${leftText(openCheckins(world, me, d).length)} · until ${ci.lockLabel(d)}`}
                aria-current={d === ci.day ? 'true' : undefined}
                onClick={() => pick(d)}
              />
            ))}
          </section>
        )}
        {closed.length > 0 && (
          <section className="flex flex-col gap-2.5">
            <div className="flex flex-col gap-1">
              <h3 className="font-nx-sans text-nx-2 font-semibold text-nx-ink-2">
                Closed
              </h3>
              <p className="text-nx-2 text-nx-ink-2">
                A change now is a late answer. It counts once {partner} approves
                it.
              </p>
            </div>
            {/* One row of day squares, oldest first, drawn like the calendar's days. */}
            <ul
              className={styles.strip}
              style={{ ['--days' as string]: closed.length }}
            >
              {[...closed].reverse().map((d) => {
                const tone = dayColor(world, me, d);
                return (
                  <li key={d} className="flex">
                    <button
                      type="button"
                      className={cn('nx-day nx-press', styles.tile)}
                      data-tone={tone}
                      data-today={d === ci.day || undefined}
                      aria-current={d === ci.day ? 'true' : undefined}
                      aria-label={`${formatDay(d)}: ${DAY_PILL[tone].label}`}
                      onClick={() => pick(d)}
                    >
                      <span aria-hidden="true">
                        {formatWeekday(d).slice(0, 3)}
                      </span>
                      <span aria-hidden="true" className="font-semibold">
                        {Number(d.slice(8))}
                      </span>
                      <DayIcon tone={tone} size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </Sheet>
  );
}

/** What an answer says, and the late answer waiting on it if there is one. */
export function answerText(rule: Rule, ci: Checkin) {
  const e = ci.entryOf(rule);
  if (!e) return 'Not answered';
  if (e.correction)
    return `${formatAnswer(rule, e)}, late answer ${formatAnswer(rule, e.correction)}`;
  return formatAnswer(rule, e);
}

/** The day's saved answers as rows; tap one to change it (a disputed one is answered in Review). */
export function DayAnswers({
  ci,
  onPick,
  className,
}: {
  ci: Checkin;
  onPick?: () => void;
  className?: string;
}) {
  const { navigate } = useNav();
  const { world, day } = ci;
  if (!day) return null;
  const answered = ci.rules.filter((r) => !ci.open.some((o) => o.id === r.id));
  // One divided list, a line per answer: the name (the answer under it), how it stands, a chevron.
  return (
    <ul className={cn('flex flex-col divide-y divide-nx-line', className)}>
      {answered.map((r) => {
        const e = ci.entryOf(r),
          pill = entryPill(world, r, e, day);
        // A Yes beside Done (or a No beside Missed) would say the same thing twice.
        const plain =
          r.kind !== 'number' &&
          !e?.correction &&
          (pill.status === 'done' || pill.status === 'missed');
        return (
          <li key={r.id}>
            <button
              type="button"
              className="nx-press flex min-h-14 w-full items-center gap-3 py-2 text-left"
              onClick={() => {
                if (e?.status === 'disputed') {
                  navigate('review');
                  return;
                }
                ci.openRule(r.id);
                onPick?.();
              }}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-pretty text-nx-body font-semibold text-nx-ink">
                  {r.title}
                </span>
                {!plain && (
                  <span className="text-pretty text-nx-2 text-nx-ink-2">
                    {answerText(r, ci)}
                  </span>
                )}
              </span>
              {/* A weekly No costs nothing: the answer says it, no pill needed. */}
              {pill.status !== 'none' && (
                <StatusPill status={pill.status} label={pill.label} />
              )}
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
  );
}

/** Everything due on the day: what is left (tap to answer it now) and what is saved (tap to change). */
export function DayListSheet({
  ci,
  open,
  onOpenChange,
}: {
  ci: Checkin;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { day } = ci;
  if (!day) return null;
  const done = ci.rules.length - ci.open.length;
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={`${formatWeekday(day)}’s check-ins`}
      description={`Until ${ci.lockLabel(day)}.`}
    >
      <div className="flex flex-col gap-7">
        {ci.open.length > 0 && (
          <section className="flex flex-col gap-2.5">
            <h3 className="font-nx-sans text-nx-2 font-semibold text-nx-ink-2">
              Left to answer
            </h3>
            {/* The heading says they're open, so only the one on screen gets a pill. */}
            {ci.open.map((r) => (
              <RowButton
                key={r.id}
                glass={false}
                title={r.title}
                trailing={
                  r.id === ci.current?.id ? (
                    <StatusPill status="open" label="On screen" />
                  ) : undefined
                }
                onClick={() => {
                  ci.openRule(r.id);
                  onOpenChange(false);
                }}
              />
            ))}
          </section>
        )}
        {done > 0 && (
          <section className="flex flex-col gap-2.5">
            <h3 className="font-nx-sans text-nx-2 font-semibold text-nx-ink-2">
              Answered
            </h3>
            <DayAnswers ci={ci} onPick={() => onOpenChange(false)} />
          </section>
        )}
      </div>
    </Sheet>
  );
}
