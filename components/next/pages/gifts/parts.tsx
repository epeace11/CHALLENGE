'use client';
import { useState, type ReactNode } from 'react';
import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
} from 'motion/react';
import { ChevronRight, CircleHelp, Plus } from 'lucide-react';
import type { Person, World } from '@/lib/next/model';
import {
  dateIn,
  formatDate,
  formatDay,
  formatDayShort,
  formatMoney,
  plural,
} from '@/lib/next/selectors';
import { useNav } from '@/components/next/nav';
import {
  Avatar,
  Button,
  CountUp,
  DURATION,
  EASE,
  Sheet,
  StatusPill,
  TextField,
} from '@/components/next/ui';
import { cn } from '@/lib/utils';
import { forgiveEffect, type Gift, type PointRow } from './ledger';
import type { Gifts } from './use-gifts';

/* ── Hooks ─────────────────────────────────────────────────────────────── */

export type SheetFor<T> = {
  target: T | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  show: (next: T) => void;
};

/** A sheet about one thing, which stays set while the sheet closes. */
export function useSheetFor<T>(): SheetFor<T> {
  const [target, setTarget] = useState<T | null>(null);
  const [open, setOpen] = useState(false);
  return {
    target,
    open,
    setOpen,
    show: (next: T) => {
      setTarget(next);
      setOpen(true);
    },
  };
}

/** A point opened in the sheet, with the world it was opened on so the sheet stays put while closing. */
export type OpenPoint = { row: PointRow; world: World };

/* ── Small pieces ──────────────────────────────────────────────────────── */

/** Something a person wrote, as a speech bubble under their avatar. */
export function Quote({
  person,
  children,
  className,
}: {
  person: Person;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <Avatar person={person} size="sm" decorative />
      <p className="min-w-0 flex-1 rounded-nx rounded-tl-md bg-nx-sunken px-4 py-2.5 text-nx-body text-nx-ink">
        <span className="sr-only">{person.name}: </span>
        {children}
      </p>
    </div>
  );
}

/**
 * Text that is struck through once a point is forgiven. When it becomes forgiven while on screen,
 * the line fades in rather than snapping.
 */
export function Struck({
  on,
  className,
  children,
}: {
  on: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [wasOn] = useState(on);
  return (
    <span
      key={on ? 'on' : 'off'}
      className={cn(
        className,
        on && 'text-nx-ink-2 line-through decoration-2',
        on &&
          !wasOn &&
          'transition-[text-decoration-color] duration-300 ease-nx starting:decoration-transparent',
      )}
    >
      {children}
    </span>
  );
}

/**
 * Content that folds away when `show` turns false (a request once it is decided) and fades back in
 * when it returns (Undo). Nothing waits for it; under reduced motion it simply goes.
 */
export function Fold({
  show,
  children,
}: {
  show: boolean;
  children: ReactNode;
}) {
  return (
    <AnimatePresence initial={false}>
      {show && <FoldBody key="fold">{children}</FoldBody>}
    </AnimatePresence>
  );
}

function FoldBody({ children }: { children: ReactNode }) {
  const present = useIsPresent();
  const still = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: still ? 0 : DURATION.slow, ease: EASE }}
      className={present ? undefined : 'pointer-events-none overflow-hidden'}
      inert={!present}
    >
      {children}
    </motion.div>
  );
}

/** "Your" or "Jordan's", for lines about the viewer or the partner. */
export const whose = (world: World, person: Person) =>
  person.id === world.me.id ? 'Your' : `${person.name}’s`;

/** The step, as a plain sentence that opens "How gifts work". */
export function StepButton({
  world,
  onClick,
  className,
}: {
  world: World;
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      variant="quiet"
      icon={CircleHelp}
      className={cn(
        '-ml-3 h-auto min-h-11 self-start py-2 text-left whitespace-normal',
        className,
      )}
      onClick={onClick}
    >
      Each point costs {formatMoney(world.challenge.step)} more than the one
      before
    </Button>
  );
}

/** What the payer's next miss adds, or that the gift has reached the cap. */
export function nextMissText(world: World, gift: Gift) {
  if (gift.nextMiss > 0)
    return `${whose(world, gift.payer)} next miss adds ${formatMoney(gift.nextMiss)}`;
  return `At the ${formatMoney(world.challenge.cap ?? 0)} cap: more misses add nothing`;
}

/* ── Gifts ─────────────────────────────────────────────────────────────── */

/**
 * One gift from the side of whoever receives it ("You get a $45 gift", "Jordan gets a $21 gift"), from whose points, what
 * the next miss adds, and who is ahead. The whole card is a button that opens the points behind it.
 */
export function GiftCard({
  world,
  gift,
  onOpen,
}: {
  world: World;
  gift: Gift;
  onOpen: () => void;
}) {
  const { recipient, payer, amount, points, ahead } = gift;
  return (
    <button
      type="button"
      className="nx-glass nx-tappable nx-pad relative flex-col items-start gap-0"
      onClick={onOpen}
    >
      <span className="flex items-center gap-2.5 pr-8">
        <Avatar person={recipient} size="sm" decorative />
        <span className="text-nx-lead font-semibold">
          {recipient.id === world.me.id
            ? 'You get a'
            : `${recipient.name} gets a`}
        </span>
      </span>
      <span className="mt-3 flex items-baseline gap-2">
        <span className="font-nx-serif text-nx-num-lg leading-none tabular-nums">
          <CountUp value={amount} format={formatMoney} />
        </span>
        <span className="font-nx-serif text-nx-h3">gift</span>
      </span>
      <span className="mt-2 text-nx-2 text-nx-ink-2">
        from {payer.id === world.me.id ? 'your' : `${payer.name}’s`}{' '}
        {plural(points, 'point')}
      </span>
      <span className="mt-4 w-full border-t border-nx-line pt-3 text-nx-2 text-nx-ink">
        {nextMissText(world, gift)}
      </span>
      {ahead ? (
        <StatusPill
          status="done"
          label={`Ahead by ${plural(ahead, 'point')}`}
          className="mt-3"
        />
      ) : null}
      <ChevronRight
        className="nx-row-chevron absolute top-5 right-4"
        size={22}
        aria-hidden="true"
      />
    </button>
  );
}

/* ── A request to forgive ──────────────────────────────────────────────── */

/**
 * The partner asks to forgive a point: their reason, what forgiving does to the viewer's gift (which
 * opens "How gifts work"), and Forgive (the page's filled button) or Decline.
 */
export function RequestDecision({
  world,
  row,
  gifts,
  onHow,
  className,
}: {
  world: World;
  row: PointRow;
  gifts: Gifts;
  /** Opens "How gifts work". */
  onHow: () => void;
  className?: string;
}) {
  const effect = forgiveEffect(world, row.point);
  if (!row.pending) return null;
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <Quote person={world.partner}>{row.pending.reason}</Quote>
      <button
        type="button"
        className="nx-press -mx-2 flex min-h-11 items-center gap-2 rounded-nx-sm px-2 py-1.5 text-left text-nx-2 text-nx-ink-2 hover:bg-nx-accent-soft"
        onClick={onHow}
      >
        <span className="min-w-0 flex-1">
          If you forgive it, the gift you get goes from{' '}
          <b className="font-semibold text-nx-ink">{formatMoney(effect.now)}</b>{' '}
          to{' '}
          <b className="font-semibold text-nx-ink">
            {formatMoney(effect.after)}
          </b>
          .
        </span>
        <ChevronRight
          size={18}
          className="shrink-0 text-nx-accent"
          aria-hidden="true"
        />
      </button>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="primary"
          className="min-w-[8.5rem] flex-1"
          onClick={() => gifts.forgive(row)}
        >
          Forgive
        </Button>
        <Button
          className="min-w-[8.5rem] flex-1"
          onClick={() => gifts.decline(row)}
        >
          Decline
        </Button>
      </div>
    </div>
  );
}

/* ── Points ────────────────────────────────────────────────────────────── */

/** A point as a row: the rule (struck through once forgiven), the day and why, and what it costs. */
export function PointRowButton({
  row,
  onOpen,
}: {
  row: PointRow;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className="nx-glass nx-tappable nx-row items-center"
      onClick={onOpen}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Struck on={row.forgiven} className="text-nx-body font-semibold">
          {row.rule.title}
        </Struck>
        <span className="text-nx-2 text-nx-ink-2">
          {formatDayShort(row.point.day)} · {row.why}
        </span>
        {row.forgiven ? (
          <StatusPill status="forgiven" className="mt-1.5 self-start" />
        ) : row.pending ? (
          <StatusPill
            status="review"
            label="Forgiveness asked"
            className="mt-1.5 self-start"
          />
        ) : null}
      </span>
      <span
        className={cn(
          'shrink-0 font-nx-serif text-nx-h3 tabular-nums',
          row.forgiven ? 'text-nx-ink-2' : 'text-nx-ink',
        )}
      >
        {formatMoney(row.cost)}
      </span>
      <ChevronRight className="nx-row-chevron" size={22} aria-hidden="true" />
    </button>
  );
}

/** A point as a receipt line: the rule, its day and why, and its price. */
export function ReceiptLine({
  row,
  onOpen,
  children,
}: {
  row: PointRow;
  onOpen: () => void;
  /** Shown under the line, such as a request to decide. */
  children?: ReactNode;
}) {
  return (
    <li className="border-b border-dashed border-nx-line-strong last:border-b-0">
      <button
        type="button"
        className="nx-press -mx-2 flex min-h-14 w-[calc(100%+1rem)] items-center gap-3 rounded-nx-sm px-2 py-2.5 text-left hover:bg-nx-accent-soft"
        onClick={onOpen}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <Struck on={row.forgiven} className="text-nx-body">
            {row.rule.title}
          </Struck>
          <span className="text-nx-2 text-nx-ink-2">
            {formatDate(row.point.day)} ·{' '}
            {row.forgiven
              ? 'Forgiven'
              : row.pending
                ? `${row.why} · Forgiveness asked`
                : row.why}
          </span>
        </span>
        <span
          className={cn(
            'shrink-0 font-nx-serif text-nx-h3 tabular-nums',
            row.forgiven && 'text-nx-ink-2',
          )}
        >
          {formatMoney(row.cost)}
        </span>
        <ChevronRight className="nx-row-chevron" size={20} aria-hidden="true" />
      </button>
      {children}
    </li>
  );
}

/** The last, dashed line of a receipt: what the payer's next miss would add. */
export function NextMissLine({
  world,
  gift,
  onClick,
}: {
  world: World;
  gift: Gift;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="nx-press mt-3 flex min-h-14 w-full items-center gap-3 rounded-nx-sm border-2 border-dashed border-nx-line-strong px-3 py-2 text-left hover:border-nx-accent-line hover:bg-nx-accent-soft"
      onClick={onClick}
    >
      <Plus
        size={18}
        strokeWidth={2.4}
        className="shrink-0 text-nx-ink-2"
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1 text-nx-body text-nx-ink-2">
        {gift.nextMiss > 0
          ? `${whose(world, gift.payer)} next miss`
          : `At the ${formatMoney(world.challenge.cap ?? 0)} cap`}
      </span>
      <span className="shrink-0 font-nx-serif text-nx-h3 text-nx-ink-2 tabular-nums">
        +{formatMoney(gift.nextMiss)}
      </span>
    </button>
  );
}

/* ── Sheets ────────────────────────────────────────────────────────────── */

/**
 * One point, opened from a list. The partner's point: forgive it (or decide their request). The
 * viewer's point: ask the partner to forgive it, with a reason. Forgiven points just say so.
 */
export function PointSheet({
  sheet,
  gifts,
}: {
  sheet: SheetFor<OpenPoint>;
  gifts: Gifts;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState(false);
  const opened = sheet.target;
  if (!opened) return null;
  const { row, world } = opened;
  const partner = world.partner;
  const mine = row.point.personId === world.me.id;
  const effect = forgiveEffect(world, row.point);
  const drop = effect.now - effect.after;
  const close = () => sheet.setOpen(false);
  const canAsk = mine && !row.forgiven && !row.pending;
  const ask = () => {
    const words = reason.trim();
    if (!words) return setError(true);
    gifts.ask(row, words);
    close();
  };

  let footer: ReactNode = null;
  if (!row.forgiven && !mine)
    footer = row.pending ? (
      <>
        <Button
          onClick={() => {
            gifts.decline(row);
            close();
          }}
        >
          Decline
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            gifts.forgive(row);
            close();
          }}
        >
          Forgive
        </Button>
      </>
    ) : (
      <>
        <Button onClick={close}>Cancel</Button>
        <Button
          variant="primary"
          onClick={() => {
            gifts.forgive(row);
            close();
          }}
        >
          Forgive
        </Button>
      </>
    );
  if (canAsk)
    footer = (
      <>
        <Button onClick={close}>Cancel</Button>
        <Button variant="primary" onClick={ask}>
          Ask {partner.name} to forgive
        </Button>
      </>
    );

  return (
    <Sheet
      open={sheet.open}
      onOpenChange={(next) => {
        sheet.setOpen(next);
        if (!next) setError(false);
      }}
      title={row.rule.title}
      description={`${formatDay(row.point.day)} · ${row.why}`}
      footer={footer}
    >
      <div className="flex flex-col gap-4">
        {row.note && (
          <Quote person={mine ? world.me : partner}>{row.note}</Quote>
        )}
        {row.forgiven ? (
          <p className="text-nx-body">
            {mine ? `${partner.name} forgave it.` : 'You forgave it.'} It costs
            nothing.
          </p>
        ) : (
          <p className="text-nx-body">
            {mine
              ? `If ${partner.name} forgives it, your gift to ${partner.name} goes from `
              : 'If you forgive it, the gift you get goes from '}
            <b className="font-semibold">{formatMoney(effect.now)}</b> to{' '}
            <b className="font-semibold">{formatMoney(effect.after)}</b>.
            {drop !== row.cost && (
              <span className="text-nx-ink-2">
                {' '}
                The points after it each move down one place.
              </span>
            )}
          </p>
        )}
        {row.pending && (
          <>
            <p className="nx-kicker">
              {mine
                ? `You asked on ${formatDate(dateIn(world.challenge.timeZone, row.pending.createdAt))}`
                : `${partner.name} asks you to forgive it`}
            </p>
            <Quote person={mine ? world.me : partner} className="-mt-2">
              {row.pending.reason}
            </Quote>
            {mine && (
              <StatusPill
                status="review"
                label={`Waiting for ${partner.name}`}
                className="self-start"
              />
            )}
          </>
        )}
        {canAsk && (
          <>
            {row.latest?.status === 'denied' && (
              <p className="text-nx-2 text-nx-ink-2">
                {partner.name} declined when you asked on{' '}
                {formatDate(
                  dateIn(world.challenge.timeZone, row.latest.createdAt),
                )}
                .
              </p>
            )}
            <TextField
              label={`Why should ${partner.name} forgive it?`}
              multiline
              rows={3}
              value={reason}
              onChange={(v) => {
                setReason(v);
                if (v.trim()) setError(false);
              }}
              error={error ? 'Write your reason first.' : undefined}
            />
          </>
        )}
      </div>
    </Sheet>
  );
}

/** "How gifts work": the step, whose points set which gift, forgiveness and the end. */
export function HowSheet({
  open,
  onOpenChange,
  world,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  world: World;
}) {
  const { navigate } = useNav();
  const { step, cap } = world.challenge;
  const partner = world.partner.name;
  const lines = [
    `Each miss is a point. The 1st point costs ${formatMoney(step)}, the 2nd ${formatMoney(2 * step)}, the 3rd ${formatMoney(3 * step)}, and so on.`,
    `Your points set the gift you buy ${partner}. ${partner}’s points set the gift you get.`,
    'A forgiven point costs nothing, and the points after it each move down one place.',
    ...(cap !== null ? [`No gift goes over ${formatMoney(cap)}.`] : []),
    'When the challenge ends, you each buy the other a gift worth that amount.',
  ];
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="How gifts work"
      footer={
        <>
          <Button onClick={() => navigate('settings')}>Change the step</Button>
          <Button variant="primary" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </>
      }
    >
      <ul className="flex flex-col gap-4">
        {lines.map((line) => (
          <li key={line} className="flex gap-3 text-nx-body">
            <span
              className="mt-2.5 size-2 shrink-0 rounded-full bg-nx-accent"
              aria-hidden="true"
            />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
