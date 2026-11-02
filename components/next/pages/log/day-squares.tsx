// The day's answers as squares, one per check-in, each a button that opens that answer.
'use client';
import type { CSSProperties } from 'react';
import type { DateString } from '@/lib/next/model';
import { entryPill, type PillStatus } from '@/lib/next/selectors';
import { useNav } from '@/components/next/nav';
import { DayIcon, type DayTone } from '@/components/next/ui';
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

/** Each kind as a day square (the kit's one way to draw a day): its colour and its icon. */
const TONE: Record<Kind, DayTone> = {
  done: 'done',
  missed: 'missed',
  wait: 'review',
  disputed: 'disputed',
  forgiven: 'excused',
  no: 'none',
  open: 'open',
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

/** What each kind is called, in the line under the squares. */
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
 * The squares in words, without their icons again: "5 done, 1 waiting for Jordan". Each square
 * already shows its colour and icon, so the page says what they add up to instead of a legend.
 */
export function dayTally(ci: Checkin) {
  const day = ci.day;
  if (!day) return '';
  const squares = squaresOf(ci, day);
  return (Object.keys(TONE) as Kind[])
    .map((k) => {
      const n = squares.filter((s) => s.kind === k).length;
      const w = word(k, ci.partner);
      return n ? `${n} ${w[0].toLowerCase()}${w.slice(1)}` : '';
    })
    .filter(Boolean)
    .join(', ');
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
  return (
    <div className={cn('flex flex-col gap-3 sm:gap-4', className)}>
      <ul className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-7">
        {squares.map(({ rule, entry, kind, status }, i) => {
          const tone = TONE[kind];
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
                  className="nx-day aspect-square w-full max-w-14 sm:max-w-16"
                  data-tone={tone}
                >
                  <DayIcon tone={tone} size={26} />
                </span>
                <span className="w-full text-center text-nx-min leading-snug text-nx-ink [overflow-wrap:anywhere]">
                  {shortTitle(rule)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
