'use client';
import { useId, type ReactNode } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  CircleCheckBig,
  Dumbbell,
  Footprints,
  Gift,
  House,
  LogOut,
  Moon,
  PiggyBank,
  Send,
  Smartphone,
  UserRound,
  Utensils,
  Wine,
  type LucideIcon,
} from 'lucide-react';
import type { Rule, RuleGroup } from '@/lib/next/model';
import { formatMoney } from '@/lib/next/selectors';
import { cn } from '@/lib/utils';
import {
  Avatar,
  Button,
  Card,
  DURATION,
  EASE,
  Item,
  Menu,
  motion,
  useReducedMotion,
} from '@/components/next/ui';
import type { InviteFlow, Suggestion } from './use-invite';

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

/** The rule's group as an icon on a soft accent tile (steps get footprints). */
export function RuleIcon({ rule }: { rule: Rule }) {
  const Icon = ICON[rule.target?.unit === 'steps' ? 'Steps' : rule.group];
  return (
    <span
      aria-hidden="true"
      className="grid size-10 shrink-0 place-items-center rounded-nx-sm bg-nx-accent-soft text-nx-accent"
    >
      <Icon size={20} strokeWidth={2} />
    </span>
  );
}

/* ── Small facts that open their details ───────────────────────────────── */

/**
 * The two short lines on how it works. Each is a row that opens its details: checking in and
 * reviewing opens How it works, the gift opens the dollar step.
 */
export function HowLines({
  flow,
  className,
}: {
  flow: InviteFlow;
  className?: string;
}) {
  const [checkIn, gift] = flow.how;
  const rows = [
    { text: checkIn, icon: CircleCheckBig, open: () => flow.open('how') },
    { text: gift, icon: Gift, open: () => flow.open('gift') },
  ];
  return (
    <ul className={cn('-mx-2 flex flex-col gap-1', className)}>
      {rows.map(({ text, icon: Icon, open }) => (
        <li key={text}>
          <button
            type="button"
            onClick={open}
            className="nx-press group flex min-h-11 w-full items-start gap-3.5 rounded-nx-sm p-2 text-left hover:bg-nx-accent-soft/60"
          >
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-full bg-nx-accent-soft text-nx-accent"
            >
              <Icon size={18} strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1 pt-1 text-nx-body text-nx-ink">
              {text}
            </span>
            <ChevronRight
              size={20}
              aria-hidden="true"
              className="mt-1.5 shrink-0 text-nx-accent transition-transform duration-200 ease-nx group-hover:translate-x-0.5"
            />
          </button>
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
  const still = useReducedMotion();
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
              transition={
                still
                  ? { duration: 0 }
                  : { duration: DURATION.slow, ease: EASE, delay: i * 0.045 }
              }
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

/* ── After Suggest a change ─────────────────────────────────────────────── */

/**
 * The suggestion Jordan sent, with Take back. Render it as
 * `{flow.sent && <SentCard key="sent" … />}` inside `<Presence mode="popLayout" initial={false}>`
 * in a `relative` column, so it glides in and out.
 */
export function SentCard({
  sent,
  to,
  onTakeBack,
}: {
  sent: Suggestion;
  to: string;
  onTakeBack: () => void;
}) {
  return (
    <Item>
      <Card className="flex items-start gap-3.5">
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-nx-accent-soft text-nx-accent"
        >
          <Send size={18} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-nx-body font-semibold">Sent to {to}</p>
          <p className="mt-0.5 text-nx-2 break-words text-nx-ink-2">
            <span className="font-semibold text-nx-ink">{sent.about}:</span>{' '}
            {sent.text}
          </p>
          <Button
            variant="quiet"
            className="-mb-2 mt-1 -ml-3"
            onClick={onTakeBack}
          >
            Take back
          </Button>
        </div>
      </Card>
    </Item>
  );
}

/* ── Signed in ──────────────────────────────────────────────────────────── */

/**
 * The action bar's glass shows the page through it when the browser skips its blur, so the bar
 * gets an opaque surface under the glass: the buttons always sit on a calm, even background.
 */
export const SOLID_BAR = 'bg-nx-surface';

/** Signed in, for the top bar: Jordan's chip opens Switch account and Sign out. */
export function AccountMenu({ flow }: { flow: InviteFlow }) {
  const { you } = flow;
  return (
    <Menu
      align="end"
      trigger={
        <button
          type="button"
          className="nx-chip nx-press hover:border-nx-accent-line"
          aria-label={`Signed in as ${you.name}. Account`}
        >
          <Avatar person={you} size="sm" decorative />
          <span>{you.name}</span>
          <ChevronDown
            size={16}
            aria-hidden="true"
            className="-ml-1 text-nx-ink-2"
          />
        </button>
      }
      items={[
        {
          label: 'Switch account',
          icon: UserRound,
          onSelect: flow.switchAccount,
        },
        { label: 'Sign out', icon: LogOut, onSelect: flow.signOut },
      ]}
    />
  );
}

/* ── A native select that looks like the kit's fields ───────────────────── */

export function SelectField({
  label,
  value,
  onChange,
  children,
  className,
}: {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn('nx-field', className)}>
      <label htmlFor={id} className="nx-field-label">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="nx-input cursor-pointer appearance-none pr-12"
        >
          {children}
        </select>
        <ChevronDown
          size={20}
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-nx-accent"
        />
      </div>
    </div>
  );
}
