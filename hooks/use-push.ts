'use client';
import { useEffect, useState } from 'react';
import {
  currentSubscription,
  disablePush,
  enablePush,
  pushSupport,
  recordSubscription,
} from '@/lib/push';

export type PushStatus =
  | 'loading'
  | 'on'
  | 'off'
  | 'denied'
  | 'install'
  | 'unsupported';

const initialStatus = (): PushStatus => {
  const support = pushSupport();
  if (support !== 'ok') return support;
  return Notification.permission === 'denied' ? 'denied' : 'loading';
};

/** Whether this device gets the evening reminders, and a way to turn them on or off. */
export function usePush() {
  const [status, setStatus] = useState<PushStatus>(initialStatus),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    if (status !== 'loading') return;
    let live = true;
    currentSubscription()
      .then(async (sub) => {
        if (!live) return;
        setStatus(sub ? 'on' : 'off');
        // Keeps the server's copy of this device current; harmless when it already is.
        if (sub) await recordSubscription(sub).catch(() => {});
      })
      .catch(() => {
        if (live) setStatus('unsupported');
      });
    return () => {
      live = false;
    };
  }, [status]);
  const toggle = async () => {
    setBusy(true);
    setError('');
    try {
      if (status === 'on') {
        await disablePush();
        setStatus('off');
      } else {
        await enablePush();
        setStatus('on');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      if (Notification.permission === 'denied') setStatus('denied');
    } finally {
      setBusy(false);
    }
  };
  return { status, busy, error, toggle };
}
