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
  PairAvatars,
  motion,
  useReducedMotion,
} from '@/components/next/ui';
import { ruleDetail, type RuleGroupView } from './invite-data';
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

/**
 * One rule as a row of a list inside a card: icon, title, when it is asked, chevron. The whole row
 * opens the rule's details.
 */
export function RuleRow({
  rule,
  onOpen,
  className,
}: {
  rule: Rule;
  onOpen: (ruleId: string) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(rule.id)}
      className={cn(
        'nx-press group flex min-h-16 w-full items-center gap-3.5 px-4 py-3 text-left hover:bg-nx-accent-soft/60 focus-visible:-outline-offset-2 sm:px-5',
        className,
      )}
    >
      <RuleIcon rule={rule} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-nx-body leading-snug font-semibold text-nx-ink">
          {rule.title}
        </span>
        <span className="text-nx-2 text-nx-ink-2">{ruleDetail(rule)}</span>
      </span>
      <ChevronRight
        size={20}
        aria-hidden="true"
        className="shrink-0 text-nx-accent transition-transform duration-200 ease-nx group-hover:translate-x-0.5"
      />
    </button>
  );
}

/** Who a group of rules is for: their avatars and "Both of you", "Only you" or "Only Maya". */
export function GroupLabel({
  group,
  className,
}: {
  group: RuleGroupView;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
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

/* ── Small facts that open their details ───────────────────────────────── */

/** A fact about the challenge ("Starts Monday, Nov 2 · 30 days") as a 44px pill that opens its sheet. */
export function FactButton({
  icon: Icon,
  children,
  onClick,
  className,
}: {
  icon: LucideIcon;
  children: ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'nx-press inline-flex min-h-11 items-center gap-2 rounded-full border border-nx-line-strong bg-nx-surface-2 py-2 pr-3 pl-3.5 text-left text-nx-2 font-semibold text-nx-ink hover:border-nx-accent-line hover:bg-nx-accent-soft',
        className,
      )}
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

/** Who is about to accept: Jordan's avatar, name and email, and Switch account under them. */
export function SignedIn({
  flow,
  className,
}: {
  flow: InviteFlow;
  className?: string;
}) {
  const { you } = flow;
  return (
    <div className={cn('flex items-start gap-3.5', className)}>
      <Avatar person={you} decorative />
      <div className="min-w-0 flex-1">
        <p className="text-nx-2 leading-snug">
          <span className="block font-semibold text-nx-ink">
            Signed in as {you.name}
          </span>
          <span className="block break-all text-nx-ink-2">{you.email}</span>
        </p>
        <Button
          variant="quiet"
          className="mt-1 -ml-3"
          onClick={flow.switchAccount}
        >
          Switch account
        </Button>
      </div>
    </div>
  );
}

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
