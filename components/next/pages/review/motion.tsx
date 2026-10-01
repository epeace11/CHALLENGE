'use client';
import { createContext, useContext, type ReactNode, type Ref } from 'react';
import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
} from 'motion/react';
import {
  Check,
  HeartHandshake,
  MessageCircle,
  TriangleAlert,
  X,
  type LucideIcon,
} from 'lucide-react';
import { DURATION, EASE } from '@/components/next/ui';
import { cn } from '@/lib/utils';

/**
 * How items leave the Review page. When one is decided it shows a stamp ("Approved", "Forgiven")
 * for a moment and folds away, all within 300 ms; the rest slide up as it folds. The world has
 * already changed by then, so nothing waits for the animation, and under reduced motion the item
 * simply goes.
 */

export type Outcome =
  | 'approved'
  | 'disputed'
  | 'declined'
  | 'forgiven'
  | 'conceded'
  | 'replied';

const STAMP: Record<
  Outcome,
  { label: string; icon: LucideIcon; tint: string; ink: string }
> = {
  approved: {
    label: 'Approved',
    icon: Check,
    tint: 'bg-nx-done-soft',
    ink: 'text-nx-done',
  },
  forgiven: {
    label: 'Forgiven',
    icon: HeartHandshake,
    tint: 'bg-nx-excused-soft',
    ink: 'text-nx-excused',
  },
  disputed: {
    label: 'Disputed',
    icon: TriangleAlert,
    tint: 'bg-nx-missed-soft',
    ink: 'text-nx-missed',
  },
  declined: {
    label: 'Declined',
    icon: X,
    tint: 'bg-nx-sunken',
    ink: 'text-nx-ink',
  },
  conceded: {
    label: 'Conceded',
    icon: Check,
    tint: 'bg-nx-wait-soft',
    ink: 'text-nx-wait',
  },
  replied: {
    label: 'Reply sent',
    icon: MessageCircle,
    tint: 'bg-nx-accent-soft',
    ink: 'text-nx-accent',
  },
};

/** Which outcome each decided item had, by item id. Exiting items read it to show their stamp. */
export const OutcomeContext = createContext<Record<string, Outcome>>({});

/** The stamp over a decided card: an opaque surface with the outcome's tint, icon and word. */
function Stamp({
  outcome,
  className,
}: {
  outcome: Outcome;
  className?: string;
}) {
  const s = STAMP[outcome];
  const Icon = s.icon;
  return (
    <motion.div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-center gap-3 overflow-hidden rounded-nx-lg bg-nx-surface',
        className,
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: DURATION.fast, ease: EASE }}
    >
      <span className={cn('absolute inset-0', s.tint)} />
      <motion.span
        className={cn(
          'relative grid size-11 place-items-center rounded-full bg-nx-surface',
          s.ink,
        )}
        initial={{ scale: 0.6 }}
        animate={{ scale: 1 }}
        transition={{ duration: DURATION.base, ease: EASE }}
      >
        <Icon size={24} strokeWidth={2.4} />
      </motion.span>
      <span className={cn('relative text-nx-lead font-semibold', s.ink)}>
        {s.label}
      </span>
    </motion.div>
  );
}

/** A column of items that can leave. Keep it mounted even when empty, so the last item can fold away. */
export function ClearList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('relative flex flex-col', className)}>
      <AnimatePresence initial={false}>{children}</AnimatePresence>
    </div>
  );
}

type DeckCustom = { direction: 1 | -1; outcomes: Record<string, Outcome> };

/**
 * One card at a time. A decided card stamps and fades in place while the next one glides in under
 * it; moving with Previous and Next slides the cards sideways (`direction` -1 goes back). Keep it
 * mounted with a null `id` once nothing is left, so the last card can still leave.
 */
export function Deck({
  id,
  direction,
  children,
}: {
  id: string | null;
  direction: 1 | -1;
  children: ReactNode;
}) {
  const outcomes = useContext(OutcomeContext);
  const custom: DeckCustom = { direction, outcomes };
  return (
    <div className="relative isolate z-10">
      <AnimatePresence mode="popLayout" initial={false} custom={custom}>
        {id !== null && (
          <DeckCard key={id} id={id} custom={custom}>
            {children}
          </DeckCard>
        )}
      </AnimatePresence>
    </div>
  );
}

function DeckCard({
  id,
  custom,
  children,
  ref,
}: {
  id: string;
  custom: DeckCustom;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}) {
  const present = useIsPresent();
  const still = useReducedMotion();
  const outcome = useContext(OutcomeContext)[id];
  const time = still ? 0 : DURATION.slow;
  return (
    <motion.div
      ref={ref}
      custom={custom}
      variants={{
        enter: (c: DeckCustom) => ({ x: 28 * c.direction, opacity: 0 }),
        center: { x: 0, opacity: 1, scale: 1 },
        exit: (c: DeckCustom) =>
          c.outcomes[id]
            ? {
                opacity: [1, 1, 0],
                scale: [1, 1, 0.97],
                transition: { duration: time, times: [0, 0.55, 1], ease: EASE },
              }
            : {
                x: -28 * c.direction,
                opacity: 0,
                transition: { duration: time, ease: EASE },
              },
      }}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: time, ease: EASE }}
      style={{ zIndex: present ? 1 : 2 }}
      className={present ? undefined : 'pointer-events-none'}
      inert={!present}
    >
      <div className="relative">
        {children}
        {!present && outcome && !still && (
          <Stamp outcome={outcome} className="bottom-0" />
        )}
      </div>
    </motion.div>
  );
}
