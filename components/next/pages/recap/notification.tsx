'use client';
import { ChevronRight } from 'lucide-react';
import { useNav } from '@/components/next/nav';
import { Button, Sheet, Toggle } from '@/components/next/ui';
import { cn } from '@/lib/utils';
import styles from './recap.module.css';

/**
 * How the Monday notification reads, drawn like a notification on a phone. It is a button: tapping
 * it opens its setting (on or off), so the numbers in it lead somewhere.
 */
export function NotificationCard({
  title,
  body,
  on,
  onOpen,
  className,
}: {
  title: string;
  body: string;
  on: boolean;
  onOpen: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'nx-glass nx-tappable flex-col items-stretch gap-1.5 rounded-[22px] px-4 py-3.5',
        styles.drop,
        className,
      )}
    >
      <span className="flex items-center gap-2.5">
        <span
          className="grid size-7 shrink-0 place-items-center rounded-lg font-nx-serif text-nx-2 text-nx-on-accent"
          style={{ background: 'var(--nx-primary)' }}
          aria-hidden="true"
        >
          C
        </span>
        <span className="flex-1 text-nx-2 font-semibold text-nx-ink-2">
          The Challenge
        </span>
        <span className="text-nx-min text-nx-ink-2">
          {on ? 'Monday' : 'Off'}
        </span>
        <ChevronRight className="nx-row-chevron" size={20} aria-hidden="true" />
      </span>
      <span className="text-nx-body font-semibold text-nx-ink">{title}</span>
      <span className="text-nx-2 text-nx-ink">{body}</span>
    </button>
  );
}

/** The notification's setting: on or off, and where the other reminders live. */
export function NotificationSheet({
  open,
  onOpenChange,
  on,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  const { navigate } = useNav();
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Monday notification"
      description="Last week’s results and what this week needs, every Monday."
      footer={
        <>
          <Button onClick={() => navigate('settings')}>Open Settings</Button>
          <Button variant="primary" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </>
      }
    >
      <Toggle checked={on} onChange={onChange} label="Send it every Monday" />
      <p className="mt-3 text-nx-2 text-nx-ink-2">
        Evening reminders to check in are in Settings.
      </p>
    </Sheet>
  );
}
