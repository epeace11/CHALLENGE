'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Clock3, LogOut, Trash2 } from 'lucide-react';
import type { World } from '@/lib/next/model';
import {
  Button,
  NumberField,
  Sheet,
  TextField,
  Toggle,
} from '@/components/next/ui';
import { formatMoney, plural } from '@/lib/next/selectors';
import { useNav } from '@/components/next/nav';
import { cn } from '@/lib/utils';
import {
  formatClock,
  giftsUnder,
  ifEndedNow,
  thenLine,
  type Terms,
} from './data';
import styles from './settings.module.css';

/* ── Reminder times ────────────────────────────────────────────────────── */

/** A labelled time picker (a native select, so it works with every keyboard and screen reader). */
export function TimeSelect({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (time: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="nx-field min-w-0">
      <label htmlFor={id} className="nx-field-label">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          className={styles.select}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((t) => (
            <option key={t} value={t}>
              {formatClock(t)}
            </option>
          ))}
        </select>
        <ChevronDown
          size={20}
          className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-nx-ink-2"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

/* ── The challenge's terms ─────────────────────────────────────────────── */

/**
 * Name, dollar step and cap, as a form. The line under the step says where both gifts would stand
 * today, so the change is easy to judge before proposing it.
 */
export function TermsFields({
  world,
  terms,
  onChange,
  error,
}: {
  world: World;
  terms: Terms;
  onChange: (t: Terms) => void;
  error: { field: 'name' | 'step' | 'cap'; text: string } | null;
}) {
  const gifts = giftsUnder(world, terms);
  const partner = world.partner.name;
  // Where the gifts would stand only matters once the step or cap differs from today's.
  const moved =
    terms.step !== world.challenge.step || terms.cap !== world.challenge.cap;
  return (
    <div className="flex flex-col gap-5">
      <TextField
        label="Challenge name"
        value={terms.name}
        onChange={(name) => onChange({ ...terms, name })}
        maxLength={40}
        autoComplete="off"
        error={error?.field === 'name' ? error.text : undefined}
      />
      <NumberField
        label="First point costs"
        value={terms.step}
        onChange={(step) => onChange({ ...terms, step: step ?? 0 })}
        unit="dollars"
        step={0.25}
        min={0}
        max={50}
        decimals
        error={error?.field === 'step' ? error.text : undefined}
        hint={
          terms.step > 0
            ? `${thenLine(terms.step)}${moved ? ` Today you would get ${formatMoney(gifts.me)} and ${partner} ${formatMoney(gifts.partner)}.` : ''}`
            : undefined
        }
      />
      <div className="flex flex-col gap-3">
        <Toggle
          checked={terms.cap !== null}
          onChange={(on) =>
            onChange({
              ...terms,
              cap: on ? Math.max(100, terms.step) : null,
            })
          }
          label="Cap each gift"
        />
        {/* No line under the switch: "No cap" says the switch again, and the amount is the field below. */}
        {terms.cap !== null && (
          <NumberField
            label="Cap"
            value={terms.cap}
            onChange={(cap) => onChange({ ...terms, cap: cap ?? 0 })}
            unit="dollars"
            step={10}
            min={0}
            max={10000}
            error={error?.field === 'cap' ? error.text : undefined}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Runs `fn` once no sheet is open: a closing sheet hands focus back to what opened it, which would
 * undo a focus made while it is still on screen. Checks each frame for about 1.5 s.
 */
function afterSheets(fn: () => void) {
  let frames = 90,
    frame = 0;
  const step = () => {
    if (document.querySelector('.nx-sheet') && frames-- > 0) {
      frame = requestAnimationFrame(step);
      return;
    }
    fn();
  };
  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}

/**
 * The viewer asked to end the challenge and the partner hasn't answered: a plain sentence and
 * Withdraw. With `focus` (it has just been asked), its heading takes focus once the sheet has gone.
 */
export function EndWaitCard({
  world,
  focus,
  onWithdraw,
}: {
  world: World;
  focus?: boolean;
  onWithdraw: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focus) return afterSheets(() => heading.current?.focus());
  }, [focus]);
  const partner = world.partner.name;
  return (
    <div className="nx-enter flex flex-col gap-3 rounded-nx border border-nx-line bg-nx-wait-soft p-4">
      <h3
        ref={heading}
        tabIndex={-1}
        className="flex items-center gap-2 font-nx-sans text-nx-body font-semibold text-nx-wait outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-nx-accent"
      >
        <Clock3 size={18} aria-hidden="true" />
        Waiting for {partner}
      </h3>
      {/* The heading says it waits for them, so this doesn't add "It ends once they agree". */}
      <p className="text-nx-body text-nx-ink">
        You asked to end {world.challenge.name} now.
      </p>
      <Button className="self-start" onClick={onWithdraw}>
        Withdraw
      </Button>
    </div>
  );
}

/** A change proposed to the partner and not answered yet, with the way to take it back. */
export function ProposalCard({
  partner,
  changes,
  onWithdraw,
}: {
  partner: string;
  changes: string[];
  onWithdraw: () => void;
}) {
  return (
    <div className="nx-enter flex flex-col gap-3 rounded-nx border border-nx-line bg-nx-wait-soft p-4">
      <p className="flex items-center gap-2 text-nx-body font-semibold text-nx-wait">
        <Clock3 size={18} aria-hidden="true" />
        Waiting for {partner}
      </p>
      <ul className="flex flex-col gap-1 text-nx-body text-nx-ink">
        {changes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <Button className="self-start" onClick={onWithdraw}>
        Withdraw
      </Button>
    </div>
  );
}

/* ── Leaving and deleting ─────────────────────────────────────────────── */

/** The partner's request to end the running challenge early, when one waits on this person. */
export function endAskFrom(world: World) {
  const ask = world.challenge.endAsk;
  return world.challenge.status === 'running' && ask && ask.by !== world.me.id
    ? ask
    : null;
}

/** Asks the partner to end the running challenge early; nothing ends until they accept. */
export function AskEndSheet({
  world,
  open,
  onOpenChange,
  onAsk,
}: {
  world: World;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAsk: () => void;
}) {
  const c = world.challenge;
  const partner = world.partner.name;
  const early = world.today <= c.start;
  const now = ifEndedNow(world);
  const id = useId();
  if (!early && openDisputes(world))
    return (
      <SettleFirst world={world} open={open} onOpenChange={onOpenChange} />
    );
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Ask ${partner} to end ${c.name}?`}
      description={
        early
          ? `It’s deleted once ${partner} agrees, since no day has counted yet. Until then, nothing changes.`
          : `It ends once ${partner} agrees: the days that are over count, and the verdict opens. Until then, nothing changes.`
      }
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Keep going</Button>
          <Button
            variant="danger"
            icon={LogOut}
            onClick={() => {
              onAsk();
              onOpenChange(false);
            }}
          >
            Ask to end it
          </Button>
        </>
      }
    >
      {!early && (
        <section
          aria-labelledby={`${id}-now`}
          className="flex flex-col gap-2 rounded-nx bg-nx-sunken px-5 py-4"
        >
          <h3 id={`${id}-now`} className="font-nx-sans text-nx-2 text-nx-ink-2">
            If it ended now
          </h3>
          <dl className="flex flex-col gap-1 text-nx-body text-nx-ink">
            <div className="flex items-baseline justify-between gap-4">
              <dt>The gift you get</dt>
              <dd className="font-semibold tabular-nums">
                {formatMoney(now.get)}
              </dd>
            </div>
            {/* The title names them, so this is just "the gift you give". */}
            <div className="flex items-baseline justify-between gap-4">
              <dt>The gift you give</dt>
              <dd className="font-semibold tabular-nums">
                {formatMoney(now.give)}
              </dd>
            </div>
          </dl>
          {now.open.length > 0 && (
            <p className="text-nx-2 text-nx-ink-2">
              {now.open.join(' and ')} wouldn’t count:{' '}
              {now.open.length === 1 ? 'it’s' : 'they’re'} still open
              {now.left > 0
                ? `, with ${plural(now.left, 'check-in')} of yours left to log.`
                : '.'}
            </p>
          )}
        </section>
      )}
    </Sheet>
  );
}

/** The partner asked to end the challenge early: Keep going turns it down, End it confirms first. */
export function EndAskCard({
  world,
  onKeep,
  onEnd,
  className,
}: {
  world: World;
  onKeep: () => void;
  onEnd: () => void;
  className?: string;
}) {
  const partner = world.partner.name;
  return (
    <div
      className={cn(
        'nx-enter flex flex-col gap-3 rounded-nx border border-nx-line bg-nx-wait-soft p-4',
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <p className="text-nx-body font-semibold text-nx-ink">
          {partner} asks to end {world.challenge.name} now
        </p>
        <p className="text-nx-2 text-nx-ink-2">It ends only if you agree.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onKeep}>Keep going</Button>
        <Button variant="danger" icon={LogOut} onClick={onEnd}>
          End it
        </Button>
      </div>
    </div>
  );
}

/**
 * Confirms ending the challenge for both, once the partner has asked (or before Day 1, when either
 * can): the days that are over count, and the gifts stay where they are.
 */
export function LeaveSheet({
  world,
  open,
  onOpenChange,
  onLeave,
}: {
  world: World;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeave: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const c = world.challenge;
  const partner = world.partner.name;
  // Nothing has counted before Day 1 is over, so the challenge is deleted instead.
  const early = world.today <= c.start;
  if (!early && openDisputes(world))
    return (
      <SettleFirst world={world} open={open} onOpenChange={onOpenChange} />
    );
  const asked = endAskFrom(world) ? `${partner} asked to end it. ` : '';
  // Once their request has named them, "for you both" says who it ends for without naming them again.
  const forWhom = asked ? 'you both' : `you and ${partner}`;
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={`End ${c.name}?`}
      description={
        early
          ? `${asked}It’s deleted for ${forWhom}, since no day has counted yet. This can’t be undone.`
          : `${asked}It ends now for ${forWhom}. The days that are over count, and the verdict opens. This can’t be undone.`
      }
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Keep going</Button>
          <Button
            variant="danger"
            icon={LogOut}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await onLeave();
              setBusy(false);
            }}
          >
            End challenge
          </Button>
        </>
      }
    />
  );
}

const openDisputes = (w: World) =>
  w.disputes.filter((d) => d.status === 'open').length;

/** A challenge can't end with a dispute open, so ending asks to settle it first. */
function SettleFirst({
  world,
  open,
  onOpenChange,
}: {
  world: World;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { navigate } = useNav();
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Settle ${plural(openDisputes(world), 'dispute')} first`}
      description={`${world.challenge.name} can’t end with a dispute open. The person who answered concedes, or the person who disputed it withdraws.`}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Keep going</Button>
          <Button variant="primary" onClick={() => navigate('review')}>
            Go to Review
          </Button>
        </>
      }
    />
  );
}

/** Confirms deleting the account, which cannot be undone. */
export function DeleteSheet({
  world,
  open,
  onOpenChange,
  onDelete,
}: {
  world: World;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Delete your account?"
      description={`Your answers, screenshots and notes are deleted, and ${world.challenge.name} ends for you and ${world.partner.name}. This can’t be undone.`}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Keep my account</Button>
          <Button variant="danger" icon={Trash2} onClick={onDelete}>
            Delete account
          </Button>
        </>
      }
    />
  );
}
