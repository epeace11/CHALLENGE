// The day's answers as squares, one per check-in, each a button that opens that answer.
'use client';
import type { CSSProperties } from 'react';
import {
  Check,
  CircleDashed,
  Clock3,
  HeartHandshake,
  MessageSquareWarning,
  Minus,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { DateString } from '@/lib/next/model';
import { entryPill, type PillStatus } from '@/lib/next/selectors';
import { useNav } from '@/components/next/nav';
import { cn } from '@/lib/utils';
import { answerText } from './days';
import { shortTitle } from './end';
import type { Checkin } from './use-checkin';

type Kind =
  | 'done'
  | 'missed'
  | 'wait'
  | 'disputed'
  | 'forgiven'
  | 'no'
  | 'open';

/** Each status by colour and by icon, so it never rests on colour alone. */
const SQUARE: Record<Kind, { icon: LucideIcon; tone: string }> = {
  done: { icon: Check, tone: 'bg-nx-done-soft text-nx-done' },
  missed: { icon: X, tone: 'bg-nx-missed-soft text-nx-missed' },
  wait: { icon: Clock3, tone: 'bg-nx-wait-soft text-nx-wait' },
  disputed: {
    icon: MessageSquareWarning,
    tone: 'bg-nx-missed-soft text-nx-missed',
  },
  forgiven: {
    icon: HeartHandshake,
    tone: 'bg-nx-excused-soft text-nx-excused',
  },
  no: { icon: Minus, tone: 'bg-nx-sunken text-nx-ink-2' },
  open: {
    icon: CircleDashed,
    tone: 'border-[1.5px] border-dashed border-nx-accent-line bg-nx-accent-soft text-nx-accent',
  },
};

const KIND: Record<PillStatus, Kind> = {
  done: 'done',
  missed: 'missed',
  review: 'wait',
  disputed: 'disputed',
  forgiven: 'forgiven',
  none: 'no',
  open: 'open',
};

/** What each kind is called in the legend. */
const word = (kind: Kind, partner: string) =>
  ({
    done: 'Done',
    missed: 'Missed',
    wait: `Waiting for ${partner}`,
    disputed: 'Disputed',
    forgiven: 'Forgiven',
    no: 'No visit',
    open: 'Open',
  })[kind];

function squaresOf(ci: Checkin, day: DateString) {
  return ci.rules.map((rule) => {
    const entry = ci.entryOf(rule),
      pill = entryPill(ci.world, rule, entry, day);
    const kind = KIND[pill.status];
    // "Waiting for review" says who it waits for; a weekly No says it in the answer.
    const status =
      pill.label === 'Waiting for review'
        ? `Waiting for ${ci.partner}`
        : kind === 'no'
          ? ''
          : pill.label;
    return { rule, entry, kind, status };
  });
}

/**
 * A square per check-in of the day, coloured and marked by where its answer stands, with the
 * rule's short name under it. Four across on phones, seven from 640px. A square opens its answer to
 * change it, or Review for a disputed one.
 */
export function DaySquares({
  ci,
  className,
}: {
  ci: Checkin;
  className?: string;
}) {
  const { navigate } = useNav();
  const day = ci.day;
  if (!day) return null;
  const squares = squaresOf(ci, day);
  const kinds = (Object.keys(SQUARE) as Kind[]).filter((k) =>
    squares.some((s) => s.kind === k),
  );
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <ul className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-7">
        {squares.map(({ rule, entry, kind, status }, i) => {
          const { icon: Icon, tone } = SQUARE[kind];
          return (
            <li
              key={rule.id}
              className="nx-enter min-w-0"
              style={{ ['--nx-i' as string]: i + 1 } as CSSProperties}
            >
              <button
                type="button"
                className="nx-press flex h-full w-full flex-col items-center gap-2 rounded-nx-sm px-0.5 pt-1 pb-2 hover:bg-nx-sunken"
                aria-label={`${shortTitle(rule)}: ${answerText(rule, ci)}${status ? `, ${status}` : ''}`}
                onClick={() => {
                  if (entry?.status === 'disputed') navigate('review');
                  else ci.openRule(rule.id);
                }}
              >
                <span
                  className={cn(
                    'grid aspect-square w-full max-w-14 place-items-center rounded-nx-sm shadow-nx-glass sm:max-w-16',
                    tone,
                  )}
                >
                  <Icon size={26} strokeWidth={2.5} aria-hidden="true" />
                </span>
                <span className="w-full text-center text-nx-min leading-snug text-nx-ink [overflow-wrap:anywhere]">
                  {shortTitle(rule)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {/* What the colours and icons mean, for the ones on screen; each square says it to screen readers. */}
      <ul
        className="flex flex-wrap gap-x-4 gap-y-1.5 text-nx-min text-nx-ink-2"
        aria-hidden="true"
      >
        {kinds.map((k) => {
          const { icon: Icon, tone } = SQUARE[k];
          return (
            <li key={k} className="flex items-center gap-1.5">
              <span
                className={cn(
                  'grid size-5 place-items-center rounded-md',
                  tone,
                )}
              >
                <Icon size={13} strokeWidth={2.6} />
              </span>
              {word(k, ci.partner)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
