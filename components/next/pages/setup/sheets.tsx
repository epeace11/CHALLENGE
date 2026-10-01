'use client';
import { useState } from 'react';
import type { Instant } from '@/lib/next/model';
import { formatTime } from '@/lib/next/selectors';
import { Button, Sheet } from '@/components/next/ui';
import { RadioRows } from './fields';
import { TIME_ZONES } from './draft';

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
