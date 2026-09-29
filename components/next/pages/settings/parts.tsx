'use client';
import { useId } from 'react';
import { ChevronDown, Clock3, LogOut, Trash2 } from 'lucide-react';
import type { World } from '@/lib/next/model';
import {
  Button,
  NumberField,
  Sheet,
  TextField,
  Toggle,
} from '@/components/next/ui';
import { formatMoney } from '@/lib/next/selectors';
import { capLine, formatClock, giftsUnder, stepLine, type Terms } from './data';
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
        label="Dollar step"
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
            ? `${stepLine(terms.step)}.${moved ? ` Today you would get ${formatMoney(gifts.me)} and ${partner} ${formatMoney(gifts.partner)}.` : ''}`
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
          description={capLine(terms.cap)}
        />
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

/** Confirms leaving: the challenge ends for both, and the gifts stay where they are. */
export function LeaveSheet({
  world,
  open,
  onOpenChange,
  onLeave,
}: {
  world: World;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeave: () => void;
}) {
  const gifts = giftsUnder(world, world.challenge);
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Leave ${world.challenge.name}?`}
      description={`It ends for you and ${world.partner.name}. The gifts stay where they are now: you get ${formatMoney(gifts.me)}, ${world.partner.name} gets ${formatMoney(gifts.partner)}.`}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Stay</Button>
          <Button variant="danger" icon={LogOut} onClick={onLeave}>
            Leave challenge
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
