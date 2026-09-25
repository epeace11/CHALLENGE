import { api } from '@/lib/api';

/**
 * Web push for the evening reminders. The public half of the VAPID key pair lives here; the
 * private half is a secret of the remind Edge Function (supabase/functions/.env, git-ignored).
 * Regenerate both together if the private key is ever lost.
 */
export const VAPID_PUBLIC_KEY =
  'BHK329imtztCqCHibSg2OQKdwhTaHs7zDAR7Rkq8MYjNPUBzteYMMZ_Qbe8U_PEicCK_bqWq8T9JQyDiZ1WWVBg';

export type PushSupport = 'ok' | 'install' | 'unsupported';

/** Whether this browser can receive push. iOS Safari only can once the app is on the home screen ('install'). */
export function pushSupport(): PushSupport {
  if (typeof window === 'undefined') return 'unsupported';
  if (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
    return 'ok';
  const ios =
      /iP(hone|ad|od)/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
    installed =
      matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true;
  return ios && !installed ? 'install' : 'unsupported';
}

const registration = () =>
  navigator.serviceWorker
    .register('/sw.js')
    .then(() => navigator.serviceWorker.ready);

/** This device's subscription, if it has one. */
export const currentSubscription = async () =>
  (await registration()).pushManager.getSubscription();

function keyBytes(base64url: string) {
  const b64 = base64url.replace(/-/g, '+').replace(/_/g, '/'),
    padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

/** Records (or refreshes) a subscription for the signed-in member. */
export async function recordSubscription(sub: PushSubscription) {
  const keys = sub.toJSON().keys;
  if (!keys?.p256dh || !keys.auth)
    throw Error('This browser gave no push keys.');
  await api.pushSubscribe(sub.endpoint, keys.p256dh, keys.auth);
}

/** Asks for permission (must run from a tap), subscribes this device and records it. */
export async function enablePush() {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted')
    throw Error(
      permission === 'denied'
        ? 'Notifications are blocked for this app. Allow them in your phone’s settings, then try again.'
        : 'Notifications were not allowed.',
    );
  const reg = await registration();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(VAPID_PUBLIC_KEY),
    }));
  await recordSubscription(sub);
}

/** Forgets this device on the server, then in the browser. */
export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await api.pushUnsubscribe(sub.endpoint);
  await sub.unsubscribe();
}
