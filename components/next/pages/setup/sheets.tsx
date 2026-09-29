'use client';
import { useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { DateString, Deadline, Instant, Person } from '@/lib/next/model';
import { formatDeadline, formatTime } from '@/lib/next/selectors';
import {
  Button,
  NumberField,
  Presence,
  Sheet,
  motion,
  useReducedMotion,
  DURATION,
  EASE,
} from '@/components/next/ui';
import { DateField, RadioRows, TextInput } from './fields';
import {
  DEADLINES,
  MAX_DAYS,
  MIN_DAYS,
  TIME_ZONES,
  deadlineId,
  deadlineLine,
  draftStakes,
  draftDays,
  rangeLine,
  type Draft,
} from './draft';
import { StakesExplained, StakesFields, StakesReadout } from './stakes';

/**
 * Sheets that edit one setting at a time. Each starts from the saved value every time it opens,
 * and changes nothing until Save.
 */

/** Runs `reset` while rendering, each time `open` turns true. */
function useResetOnOpen(open: boolean, reset: () => void) {
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) reset();
  }
}

type SheetProps = { open: boolean; onOpenChange: (open: boolean) => void };

function Footer({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <>
      <Button onClick={onCancel}>Cancel</Button>
      <Button variant="primary" onClick={onSave}>
        Save
      </Button>
    </>
  );
}

/** The time zone the days and deadlines follow. */
export function TimeZoneSheet({
  open,
  onOpenChange,
  value,
  detected,
  now,
  onSave,
}: SheetProps & {
  value: string;
  detected: string;
  now: Instant;
  onSave: (timeZone: string) => void;
}) {
  const [pending, setPending] = useState(value);
  useResetOnOpen(open, () => setPending(value));
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Time zone"
      description="Days and deadlines follow this time zone."
      footer={
        <Footer
          onCancel={() => onOpenChange(false)}
          onSave={() => {
            onSave(pending);
            onOpenChange(false);
          }}
        />
      }
    >
      <RadioRows
        label="Time zone"
        value={pending}
        onChange={setPending}
        options={TIME_ZONES.map((z) => ({
          value: z.id,
          title: z.city,
          detail: `${z.region} · ${formatTime(now, z.id)} now`,
          aside:
            z.id === detected ? (
              <span className="shrink-0 rounded-full bg-nx-sunken px-3 py-1 text-nx-min font-semibold text-nx-ink-2">
                Detected
              </span>
            ) : undefined,
        }))}
      />
    </Sheet>
  );
}

/** The challenge's name. */
export function NameSheet({
  open,
  onOpenChange,
  value,
  onSave,
}: SheetProps & { value: string; onSave: (name: string) => void }) {
  const [pending, setPending] = useState(value);
  const [error, setError] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  useResetOnOpen(open, () => {
    setPending(value);
    setError(undefined);
  });
  const save = () => {
    if (!pending.trim()) return setError('Name the challenge.');
    onSave(pending.trim());
    onOpenChange(false);
  };
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Name"
      initialFocus={input}
      footer={<Footer onCancel={() => onOpenChange(false)} onSave={save} />}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <TextInput
          label="Challenge name"
          value={pending}
          onChange={(v) => {
            setPending(v);
            setError(undefined);
          }}
          maxLength={40}
          error={error}
          inputRef={input}
        />
      </form>
    </Sheet>
  );
}

/** The first day and how many days it runs. */
export function DatesSheet({
  open,
  onOpenChange,
  start,
  days,
  onSave,
}: SheetProps & {
  start: DateString;
  days: number | null;
  onSave: (next: { start: DateString; days: number }) => void;
}) {
  const [pending, setPending] = useState({ start, days });
  const [error, setError] = useState<string>();
  useResetOnOpen(open, () => {
    setPending({ start, days });
    setError(undefined);
  });
  const save = () => {
    if (!pending.days) return setError('Enter how many days it runs.');
    onSave({ start: pending.start, days: pending.days });
    onOpenChange(false);
  };
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Dates"
      footer={<Footer onCancel={() => onOpenChange(false)} onSave={save} />}
    >
      <div className="flex flex-col gap-6">
        <DateField
          label="First day"
          value={pending.start}
          onChange={(v) => setPending({ ...pending, start: v })}
        />
        <NumberField
          label="Length"
          value={pending.days}
          onChange={(v) => {
            setPending({ ...pending, days: v });
            setError(undefined);
          }}
          unit="days"
          step={1}
          min={MIN_DAYS}
          max={MAX_DAYS}
          error={error}
          hint={rangeLine(pending.start, draftDays(pending))}
        />
      </div>
    </Sheet>
  );
}

/** When each day's logging closes. */
export function DeadlineSheet({
  open,
  onOpenChange,
  value,
  onSave,
}: SheetProps & { value: Deadline; onSave: (deadline: Deadline) => void }) {
  const [pending, setPending] = useState(deadlineId(value));
  useResetOnOpen(open, () => setPending(deadlineId(value)));
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Deadline"
      description="Each day’s check-ins can be logged until then."
      footer={
        <Footer
          onCancel={() => onOpenChange(false)}
          onSave={() => {
            const chosen = DEADLINES.find((d) => d.id === pending);
            if (chosen) onSave(chosen.deadline);
            onOpenChange(false);
          }}
        />
      }
    >
      <RadioRows
        label="Deadline"
        value={pending}
        onChange={setPending}
        options={DEADLINES.map((d) => ({
          value: d.id,
          title: formatDeadline(d.deadline),
          detail: deadlineLine(d.deadline),
        }))}
      />
    </Sheet>
  );
}

/** What the first point costs and the cap, with the stakes preview following every change. */
export function StakesSheet({
  open,
  onOpenChange,
  draft,
  people,
  onSave,
}: SheetProps & {
  draft: Draft;
  people: Person[];
  onSave: (next: { step: number; capOn: boolean; cap: number | null }) => void;
}) {
  const saved = { step: draft.step, capOn: draft.capOn, cap: draft.cap };
  const [pending, setPending] = useState(saved);
  const [error, setError] = useState<string>();
  const [explain, setExplain] = useState(false);
  useResetOnOpen(open, () => {
    setPending(saved);
    setError(undefined);
    setExplain(false);
  });
  const still = useReducedMotion();
  const trial = { ...draft, ...pending };
  const stakes = draftStakes(trial, people);
  const cap = pending.capOn ? pending.cap : null;
  const save = () => {
    if (pending.capOn && !pending.cap)
      return setError(
        'Enter the most a gift can reach, or switch the cap off.',
      );
    onSave(pending);
    onOpenChange(false);
  };
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Stakes"
      footer={<Footer onCancel={() => onOpenChange(false)} onSave={save} />}
    >
      <div className="flex flex-col gap-6">
        <StakesFields
          step={pending.step}
          capOn={pending.capOn}
          cap={pending.cap}
          capError={error}
          onChange={(next) => {
            setPending({ ...pending, ...next });
            setError(undefined);
          }}
          readout={<StakesReadout gift={stakes.gift} />}
        />
        <div className="border-t border-nx-line pt-2">
          <Button
            variant="quiet"
            className="-ml-3 [&>svg:last-child]:transition-transform [&>svg:last-child]:duration-200 aria-expanded:[&>svg:last-child]:rotate-180"
            iconEnd={ChevronDown}
            aria-expanded={explain}
            onClick={() => setExplain(!explain)}
          >
            How the gift adds up
          </Button>
          <Presence initial={false}>
            {explain && (
              <motion.div
                key="explain"
                className="overflow-hidden"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: still ? 0 : DURATION.base, ease: EASE }}
              >
                <div className="pt-2">
                  <StakesExplained
                    step={pending.step}
                    cap={cap}
                    stakes={stakes}
                    people={people}
                    days={draftDays(draft)}
                  />
                </div>
              </motion.div>
            )}
          </Presence>
        </div>
      </div>
    </Sheet>
  );
}
