'use client';
import type { CSSProperties, ReactNode } from 'react';
import {
  BookOpen,
  Check,
  ChevronRight,
  Dumbbell,
  Footprints,
  House,
  Moon,
  PiggyBank,
  Smartphone,
  Utensils,
  Wine,
  type LucideIcon,
} from 'lucide-react';
import type { Rule, RuleGroup } from '@/lib/next/model';
import { formatMoney } from '@/lib/next/selectors';
import { cn } from '@/lib/utils';
import {
  Avatar,
  CountUp,
  DURATION,
  EASE,
  PairAvatars,
  motion,
  useReducedMotion,
} from '@/components/next/ui';
import {
  dayAndTime,
  ruleDetail,
  type RuleGroupView,
  type Signer,
} from './pact-data';

/**
 * The action bar's glass shows the page through it when the browser skips its blur, so the bar
 * gets an opaque surface under the glass: the Sign button always sits on a calm, even background.
 */
export const SOLID_BAR = 'bg-nx-surface';

/** A Motion transition in the kit's timing, or none at all under reduced motion. */
function useTiming() {
  const still = useReducedMotion();
  return (duration: number, delay = 0) =>
    still ? { duration: 0 } : { duration, delay, ease: EASE };
}

/* ── Rules ──────────────────────────────────────────────────────────────── */

const ICON: Record<RuleGroup | 'Steps', LucideIcon> = {
  Sleep: Moon,
  Screens: Smartphone,
  Food: Utensils,
  Drinks: Wine,
  Movement: Dumbbell,
  Steps: Footprints,
  Mind: BookOpen,
  Money: PiggyBank,
  Home: House,
};

export function RuleIcon({ rule }: { rule: Rule }) {
  const Icon = ICON[rule.target?.unit === 'steps' ? 'Steps' : rule.group];
  return (
    <span
      aria-hidden="true"
      className="grid size-9 shrink-0 place-items-center rounded-nx-sm bg-nx-accent-soft text-nx-accent"
    >
      <Icon size={18} strokeWidth={2} />
    </span>
  );
}

/**
 * One rule in the pact's summary: icon, title and when it is asked. With `onOpen` the whole line is
 * a button, with a chevron, that opens the rule's details.
 */
export function RuleLine({
  rule,
  tag,
  onOpen,
}: {
  rule: Rule;
  tag?: string;
  onOpen?: (ruleId: string) => void;
}) {
  const inside = (
    <>
      <RuleIcon rule={rule} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-start gap-2">
          <span className="min-w-0 flex-1 text-nx-body leading-snug font-semibold text-nx-ink">
            {rule.title}
          </span>
          {tag && (
            <span className="mt-0.5 shrink-0 rounded-full bg-nx-accent-soft px-2.5 py-1 text-nx-min leading-none font-semibold text-nx-accent">
              {tag}
            </span>
          )}
        </span>
        <span className="text-nx-2 text-nx-ink-2">{ruleDetail(rule)}</span>
      </span>
    </>
  );
  if (!onOpen)
    return <div className="flex items-center gap-3.5 py-2.5">{inside}</div>;
  return (
    <button
      type="button"
      onClick={() => onOpen(rule.id)}
      className="nx-press group -mx-2 flex min-h-14 w-[calc(100%+1rem)] items-center gap-3.5 rounded-nx-sm px-2 py-2.5 text-left hover:bg-nx-accent-soft/60"
    >
      {inside}
      <ChevronRight
        size={20}
        aria-hidden="true"
        className="shrink-0 text-nx-accent transition-transform duration-200 ease-nx group-hover:translate-x-0.5"
      />
    </button>
  );
}

/** Who a group of rules is for: their avatars and "Both of you", "Only you" or "Only Maya". */
export function GroupLabel({ group }: { group: RuleGroupView }) {
  return (
    <div className="flex items-center gap-3 pt-1 pb-1">
      <span aria-hidden="true" className="flex">
        {group.people.length > 1 ? (
          <PairAvatars people={group.people} size="sm" />
        ) : (
          <Avatar person={group.people[0]} size="sm" decorative />
        )}
      </span>
      <h3 className="font-nx-sans text-nx-2 font-semibold text-nx-ink-2">
        {group.title}
      </h3>
    </div>
  );
}

/* ── Facts and terms ───────────────────────────────────────────────────── */

/** A fact about the challenge ("Starts Monday, Nov 2") as a 44px pill that opens its details. */
export function FactButton({
  icon: Icon,
  children,
  onClick,
}: {
  icon: LucideIcon;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="nx-press inline-flex min-h-11 items-center gap-2 rounded-full border border-nx-line-strong bg-nx-surface-2 py-2 pr-3 pl-3.5 text-left text-nx-2 font-semibold text-nx-ink hover:border-nx-accent-line hover:bg-nx-accent-soft"
    >
      <Icon size={18} aria-hidden="true" className="shrink-0 text-nx-accent" />
      <span>{children}</span>
      <ChevronRight
        size={16}
        aria-hidden="true"
        className="shrink-0 text-nx-accent"
      />
    </button>
  );
}

/** What signing means, one plain sentence each. */
export function Terms({
  terms,
  className,
}: {
  terms: readonly string[];
  className?: string;
}) {
  return (
    <ul className={cn('flex flex-col gap-3.5', className)}>
      {terms.map((term) => (
        <li key={term} className="flex items-start gap-3.5">
          <span
            aria-hidden="true"
            className="mt-[9px] size-2 shrink-0 rounded-full bg-nx-accent"
          />
          <p className="text-nx-body text-nx-ink">{term}</p>
        </li>
      ))}
    </ul>
  );
}

/** The dollar step as six rising bars that grow in turn: the nth miss costs n steps. */
export function StepBars({
  step,
  count = 6,
}: {
  step: number;
  count?: number;
}) {
  const timing = useTiming();
  const costs = Array.from({ length: count }, (_, i) =>
    formatMoney(step * (i + 1)),
  );
  return (
    <>
      <p className="sr-only">
        Misses 1 to {count} cost {costs.join(', ')}.
      </p>
      <div
        aria-hidden="true"
        className="grid items-end gap-2"
        style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
      >
        {costs.map((cost, i) => (
          <div key={cost} className="flex flex-col items-center gap-1.5">
            <motion.span
              className="w-full rounded-t-[10px] rounded-b-[4px] bg-nx-accent"
              style={{
                height: 20 + (i + 1) * 14,
                opacity: 0.35 + (0.65 * i) / Math.max(1, count - 1),
                originY: 1,
              }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={timing(DURATION.slow, i * 0.045)}
            />
            <span className="text-nx-min font-semibold text-nx-ink-2 tabular-nums">
              {cost}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

/* ── Signatures ─────────────────────────────────────────────────────────── */

/**
 * A name written on the line in Georgia italic, with a flourish under it. `drawn` writes it in,
 * left to right, then draws the flourish: for the one who has just signed.
 */
function Script({ name, drawn }: { name: string; drawn?: boolean }) {
  const timing = useTiming();
  return (
    <span
      aria-hidden="true"
      className="relative inline-block pr-3 pb-1.5 pl-0.5 font-nx-serif text-[32px] leading-[1.1] tracking-[0.01em] whitespace-nowrap text-nx-ink italic"
    >
      <motion.span
        className="inline-block"
        initial={drawn ? { clipPath: 'inset(-20% 100% -30% -6%)' } : false}
        animate={{ clipPath: 'inset(-20% -20% -30% -6%)' }}
        transition={timing(DURATION.slow)}
      >
        {name}
      </motion.span>
      <svg
        viewBox="0 0 200 14"
        preserveAspectRatio="none"
        className="absolute -bottom-0.5 left-0 h-3.5 w-full overflow-visible fill-none stroke-nx-accent stroke-2 [stroke-linecap:round]"
      >
        <motion.path
          d="M2 9 C 40 2, 72 13, 108 7 S 170 3, 198 8"
          initial={drawn ? { pathLength: 0 } : false}
          animate={{ pathLength: 1 }}
          transition={timing(DURATION.slow, 0.12)}
        />
      </svg>
    </span>
  );
}

/** A green check; `drawn` pops it in just after the name is written. */
export function CheckBadge({
  drawn,
  className,
  style,
}: {
  drawn?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const timing = useTiming();
  const look = cn(
    'grid size-9 shrink-0 place-items-center rounded-full bg-nx-done-soft text-nx-done',
    className,
  );
  const icon = <Check size={20} strokeWidth={2.6} />;
  if (!drawn)
    return (
      <span aria-hidden="true" className={look} style={style}>
        {icon}
      </span>
    );
  return (
    <motion.span
      aria-hidden="true"
      className={look}
      style={style}
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: [0.5, 1.1, 1], opacity: [0, 1, 1] }}
      transition={{ ...timing(DURATION.slow, 0.15), times: [0, 0.7, 1] }}
    >
      {icon}
    </motion.span>
  );
}

/** One soft ring that runs out from a card when both have signed. Put it inside the card. */
export function SealRing() {
  const still = useReducedMotion();
  if (still) return null;
  return (
    <motion.span
      aria-hidden="true"
      className="pointer-events-none absolute -inset-px rounded-[inherit] border-2 border-nx-accent"
      initial={{ opacity: 0.7, scale: 1 }}
      animate={{ opacity: 0, scale: 1.025 }}
      transition={{ duration: DURATION.slow, ease: EASE, delay: 0.2 }}
    />
  );
}

/**
 * One signature: the line (with the name written on it once signed), who it is and when they
 * signed. `children` go under it (the Sign button on Jordan's line).
 */
export function SignatureRow({
  signer,
  timeZone,
  drawn,
  avatar = true,
  children,
  className,
}: {
  signer: Signer;
  timeZone: string;
  /** Write the name in: Jordan has just signed. */
  drawn?: boolean;
  /** Leave the avatar out when the card around it already shows the person. */
  avatar?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const timing = useTiming();
  const { person, you, signedAt } = signer;
  const who = you ? 'You' : person.name;
  return (
    <div className={cn('flex items-start gap-3.5', className)}>
      {avatar && <Avatar person={person} decorative className="mt-3" />}
      <div className="min-w-0 flex-1">
        {/* The same height signed or not, so signing moves nothing. */}
        <div
          className={cn(
            'relative flex h-[52px] items-end border-b-[1.5px] border-nx-line-strong',
            !signedAt && 'border-dashed',
          )}
        >
          {signedAt && <Script name={person.name} drawn={drawn} />}
          {signedAt && <CheckBadge drawn={drawn} className="mb-2 ml-auto" />}
        </div>
        <motion.p
          key={signedAt ? 'signed' : 'not-signed'}
          className="mt-2 text-nx-2 text-nx-ink-2"
          initial={signedAt && drawn ? { opacity: 0, y: 6 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={timing(DURATION.base, 0.15)}
        >
          <span className="font-semibold text-nx-ink">{who}</span>
          {' · '}
          {signedAt
            ? `Signed ${dayAndTime(signedAt, timeZone)}`
            : 'Not signed yet'}
        </motion.p>
        {children}
      </div>
    </div>
  );
}

/* ── The countdown ──────────────────────────────────────────────────────── */

/** "Day 1 starts in 1 day 3 hours": both numbers count up; it opens what happens on Day 1. */
export function CountdownButton({
  days,
  hours,
  day,
  onClick,
  className,
}: {
  days: number;
  hours: number;
  /** "Monday, Nov 2" */
  day: string;
  onClick: () => void;
  className?: string;
}) {
  const part = (n: number, one: string, many: string) => (
    <span className="flex items-baseline gap-1.5">
      <span className="font-nx-serif text-nx-num-lg text-nx-accent tabular-nums">
        <CountUp value={n} />
      </span>
      <span className="text-nx-lead text-nx-ink">{n === 1 ? one : many}</span>
    </span>
  );
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('nx-glass nx-tappable nx-stat relative', className)}
    >
      <span className="nx-stat-label">Day 1 starts in</span>
      <span className="flex flex-wrap items-baseline gap-x-5 gap-y-1 py-1">
        {days > 0 && part(days, 'day', 'days')}
        {part(hours, 'hour', 'hours')}
      </span>
      <span className="nx-stat-hint">{day}</span>
      <ChevronRight className="nx-row-chevron" size={20} aria-hidden="true" />
    </button>
  );
}
