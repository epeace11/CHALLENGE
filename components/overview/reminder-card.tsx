'use client';
import { Bell, BellOff } from 'lucide-react';
import { usePush, type PushStatus } from '@/hooks/use-push';

const COPY: Record<PushStatus, string> = {
  loading: 'Checking this device…',
  on: 'On for this device: a nudge at 8 pm and again at 10 pm whenever something for the day is still unlogged.',
  off: 'Get a nudge at 8 pm and again at 10 pm whenever something for the day is still unlogged.',
  denied:
    'Notifications are blocked for this app. Allow them in your phone’s settings, then come back here.',
  install:
    'To get reminders on iPhone, add this app to your home screen (Share → Add to Home Screen) and turn them on from there.',
  unsupported: 'This browser can’t show notifications.',
};

/** Turns the evening push reminders on or off for this device. */
export function ReminderCard() {
  const { status, busy, error, toggle } = usePush();
  const Icon = status === 'on' ? Bell : BellOff;
  return (
    <section className="glass compact reminders">
      <div>
        <h3>
          <Icon size={18} />
          Reminders
        </h3>
        <p className="muted">{COPY[status]}</p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </div>
      {(status === 'on' || status === 'off') && (
        <button
          className={status === 'off' ? 'primary' : ''}
          disabled={busy}
          onClick={() => void toggle()}
        >
          {status === 'on' ? 'Turn off' : 'Turn on'}
        </button>
      )}
    </section>
  );
}
