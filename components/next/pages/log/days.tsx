'use client';
import { CalendarDays, Check } from 'lucide-react';
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
import { RowButton, Sheet, StatusPill } from '@/components/next/ui';
import { cn } from '@/lib/utils';
import type { Checkin } from './use-checkin';

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
      <div className="flex flex-col gap-7">
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
            {closed.map((d) => {
              const pill = DAY_PILL[dayColor(world, me, d)];
              return (
                <RowButton
                  key={d}
                  glass={false}
                  leading={<DayMark on={d === ci.day} />}
                  title={formatDay(d)}
                  trailing={
                    <StatusPill status={pill.status} label={pill.label} />
                  }
                  aria-current={d === ci.day ? 'true' : undefined}
                  onClick={() => pick(d)}
                />
              );
            })}
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
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {answered.map((r) => {
        const e = ci.entryOf(r),
          pill = entryPill(world, r, e, day);
        return (
          <RowButton
            key={r.id}
            glass={false}
            title={r.title}
            detail={
              <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                <span>{answerText(r, ci)}</span>
                {/* A weekly No costs nothing: the answer says it, no pill needed. */}
                {pill.status !== 'none' && (
                  <StatusPill status={pill.status} label={pill.label} />
                )}
              </span>
            }
            onClick={() => {
              if (e?.status === 'disputed') {
                navigate('review');
                return;
              }
              ci.openRule(r.id);
              onPick?.();
            }}
          />
        );
      })}
    </div>
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
            {ci.open.map((r) => (
              <RowButton
                key={r.id}
                glass={false}
                title={r.title}
                trailing={
                  <StatusPill
                    status="open"
                    label={r.id === ci.current?.id ? 'On screen' : 'Open'}
                  />
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
