'use client';
import { useState, type ReactNode } from 'react';
import {
  ArrowRight,
  BookmarkCheck,
  BookmarkPlus,
  BookOpen,
  CalendarDays,
  Cannabis,
  Footprints,
  GlassWater,
  House,
  ListChecks,
  MoonStar,
  PiggyBank,
  Smartphone,
  Utensils,
  WineOff,
  type LucideIcon,
} from 'lucide-react';
import type {
  DateString,
  Look,
  Rule,
  RuleGroup,
  SavedChallenge,
} from '@/lib/next/model';
import {
  Button,
  Card,
  CountUp,
  NumberField,
  PairAvatars,
  Sheet,
} from '@/components/next/ui';
import {
  formatDay,
  formatMoney,
  formatWhen,
  giftTotal,
  plural,
  shift,
  stakesPreview,
} from '@/lib/next/selectors';
import { cn } from '@/lib/utils';
import { answerText, costSteps, lookName, nextMonday, sharers } from './facts';

/** The pieces both versions of the shared-link page are built from. */

/* ── Who shared it, and its look ───────────────────────────────────────── */

/** "Shared by Priya & Sam" with their two avatars (decorative: the names are written out). */
export function SharedBy({ by }: { by: string | null }) {
  const pair = sharers(by);
  if (!by) return null;
  return (
    <div className="flex items-center gap-3">
      {pair && (
        <span aria-hidden="true" className="flex">
          <PairAvatars people={pair} size="sm" />
        </span>
      )}
      <p className="text-nx-2 font-semibold text-nx-accent">Shared by {by}</p>
    </div>
  );
}

/** "● Dry look": the look's colour and name. */
export function LookLabel({
  look,
  className,
}: {
  look: Look;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'flex items-center gap-2 text-nx-2 text-nx-ink-2',
        className,
      )}
    >
      <span
        data-look={look}
        className="size-4 shrink-0 rounded-full"
        style={{ background: 'var(--nx-primary)' }}
        aria-hidden="true"
      />
      {lookName(look)} look
    </p>
  );
}

/* ── Rows ──────────────────────────────────────────────────────────────── */

/** An icon on a soft accent tile, for rows. */
export function IconTile({
  icon: Icon,
  className,
}: {
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'grid size-10 shrink-0 place-items-center rounded-nx-sm bg-nx-accent-soft text-nx-accent',
        className,
      )}
      aria-hidden="true"
    >
      <Icon size={20} />
    </span>
  );
}

const GROUP_ICON: Record<RuleGroup, LucideIcon> = {
  Sleep: MoonStar,
  Screens: Smartphone,
  Food: Utensils,
  Drinks: GlassWater,
  Movement: Footprints,
  Mind: BookOpen,
  Money: PiggyBank,
  Home: House,
};

/** A rule's icon: its own for alcohol and weed, otherwise its group's. */
export function RuleIcon({ rule }: { rule: Rule }) {
  const icon = /\bweed\b/i.test(rule.title)
    ? Cannabis
    : /\balcohol\b/i.test(rule.title)
      ? WineOff
      : (GROUP_ICON[rule.group] ?? ListChecks);
  return <IconTile icon={icon} />;
}

/* ── Save for later ────────────────────────────────────────────────────── */

/** "Save for later", then "Saved" (pressed) once it is in Your challenges. */
export function SaveButton({
  saved,
  onClick,
  size,
  className,
}: {
  saved: boolean;
  onClick: () => void;
  size?: 'md' | 'lg';
  className?: string;
}) {
  return (
    <Button
      size={size}
      icon={saved ? BookmarkCheck : BookmarkPlus}
      aria-pressed={saved}
      className={cn(
        'aria-pressed:border-nx-accent aria-pressed:bg-nx-accent-soft',
        className,
      )}
      onClick={onClick}
    >
      {saved ? 'Saved' : 'Save for later'}
    </Button>
  );
}

/* ── Sheets: the details behind each number and rule ─────────────────────── */

/** Gives what it wraps the challenge's look, when there is one (sheets open outside the page). */
function InLook({ look, children }: { look?: Look; children: ReactNode }) {
  if (!look) return <>{children}</>;
  return (
    <div data-look={look} className="contents">
      {children}
    </div>
  );
}

/** Try a number of misses and watch the gift add up at this challenge's step. */
function CostExample({ step, cap }: { step: number; cap: number | null }) {
  const [misses, setMisses] = useState(3);
  const total = giftTotal(misses, step, cap);
  return (
    <Card className="flex flex-col gap-4">
      <NumberField
        label="If you miss"
        unit={misses === 1 ? 'check-in' : 'check-ins'}
        value={misses}
        onChange={(n) => setMisses(n ?? 0)}
        step={1}
        min={0}
        max={31}
      />
      <div className="flex flex-col gap-1.5" aria-live="polite">
        <p className="text-nx-2 font-semibold">The gift you owe your partner</p>
        <p className="font-nx-serif text-nx-num text-nx-accent">
          <CountUp value={total} format={formatMoney} />
        </p>
        {misses > 0 && misses <= 6 && total === giftTotal(misses, step) && (
          <p className="text-nx-2 text-nx-ink-2">{costSteps(misses, step)}</p>
        )}
      </div>
    </Card>
  );
}

/** Every sheet on the page: the dates, what misses cost, and one per rule. */
export function SharedSheets({
  shared,
  today,
  open,
  onClose,
  onStart,
  look,
}: {
  shared: SavedChallenge;
  today: DateString;
  /** Which sheet is open: 'length', 'cost', or a rule's id. */
  open: string | null;
  onClose: () => void;
  onStart: () => void;
  /** Give the sheets the challenge's look (the page wears it too). */
  look?: Look;
}) {
  const from = nextMonday(today),
    to = shift(from, shared.days - 1);
  const stakes = stakesPreview({ ...shared, start: from }, 0.1);
  const change = (next: boolean) => {
    if (!next) onClose();
  };
  const startButton = (
    <InLook look={look}>
      <Button variant="primary" iconEnd={ArrowRight} onClick={onStart}>
        Start this challenge
      </Button>
    </InLook>
  );

  return (
    <>
      <Sheet
        open={open === 'length'}
        onOpenChange={change}
        title={plural(shared.days, 'day')}
        description="You pick the first day when you set it up."
        footer={startButton}
      >
        <InLook look={look}>
          <Card className="flex items-start gap-4">
            <IconTile icon={CalendarDays} />
            <p className="text-nx-body">
              Start on {formatDay(from)}, and the last day is {formatDay(to)}.
            </p>
          </Card>
        </InLook>
      </Sheet>

      <Sheet
        open={open === 'cost'}
        onOpenChange={change}
        title="What misses cost"
        description={`Each miss is a point. The first costs ${formatMoney(shared.step)}, the second ${formatMoney(2 * shared.step)}, and so on. At the end, each of you buys the other a gift worth your own points.`}
        footer={startButton}
      >
        <InLook look={look}>
          <div className="flex flex-col gap-4">
            <CostExample step={shared.step} cap={shared.cap} />
            <p className="text-nx-body text-nx-ink-2">
              If you each miss 1 in 10 check-ins, each gift comes to about{' '}
              {formatMoney(stakes.gift)}.
              {shared.cap !== null &&
                ` No gift goes over ${formatMoney(shared.cap)}.`}
            </p>
          </div>
        </InLook>
      </Sheet>

      {shared.rules.map((rule) => (
        <Sheet
          key={rule.id}
          open={open === rule.id}
          onOpenChange={change}
          title={rule.title}
          description={rule.description}
        >
          <dl className="flex flex-col">
            {[
              ['Asked each day', `“${rule.question}”`],
              ['Days', formatWhen(rule)],
              ['Answer', answerText(rule)],
              [
                'Screenshot',
                rule.proof === 'none'
                  ? 'Not needed'
                  : rule.proof === 'optional'
                    ? 'Optional'
                    : 'Required with a Yes',
              ],
              ['For', rule.who === 'both' ? 'Both of you' : 'One of you'],
            ].map(([term, value]) => (
              <div
                key={term}
                className="flex flex-col gap-0.5 border-b border-nx-line py-3 last:border-b-0 sm:flex-row sm:gap-4"
              >
                <dt className="text-nx-2 text-nx-ink-2 sm:w-36 sm:shrink-0">
                  {term}
                </dt>
                <dd className="text-nx-body text-nx-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </Sheet>
      ))}
    </>
  );
}
