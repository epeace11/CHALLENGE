// Supabase Edge Function (Deno), called every hour by pg_cron (supabase/push-reminders-schedule.sql).
// At the reminder hours it sends one web push to each member who still has unlogged daily habits for
// the day that locks at 11:59 pm tonight. Deploy with
//   supabase functions deploy remind --no-verify-jwt --project-ref llctyiwwcytwmemmnrvw
// Secrets (supabase/functions/.env): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, REMIND_SECRET.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

/** Toronto hours at which a reminder goes out when something is still unlogged. */
const REMIND_AT = [20, 22];
const TIME_ZONE = 'America/Toronto';

type Due = {
  user_id: string;
  name: string;
  day: string;
  missing: number;
  titles: string[];
};
type Sub = { endpoint: string; user_id: string; p256dh: string; auth: string };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const torontoHour = (d = new Date()) =>
  Number(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TIME_ZONE,
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(d),
  );

/** "Wednesday, Sep 23", like formatDate in lib/dates.ts. */
const formatDay = (day: string) =>
  new Date(day + 'T12:00Z').toLocaleDateString('en-CA', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

function message(d: Due) {
  const shown = d.titles.slice(0, 2).join(', '),
    more = d.titles.length > 2 ? ` and ${d.titles.length - 2} more` : '';
  return {
    title: `${d.missing} ${d.missing === 1 ? 'habit' : 'habits'} still unlogged`,
    body: `${formatDay(d.day)} locks at 11:59 pm: ${shown}${more}.`,
    tag: `remind-${d.day}`,
    url: '/',
  };
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('REMIND_SECRET');
  if (!secret || req.headers.get('x-remind-secret') !== secret)
    return json({ error: 'Forbidden' }, 403);
  const hour = torontoHour(),
    force = new URL(req.url).searchParams.get('force') === '1';
  if (!force && !REMIND_AT.includes(hour))
    return json({ sent: 0, skipped: `hour ${hour}` });

  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT') ?? 'https://thechallenge.win',
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!,
  );
  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data: dueRows, error } = await db.rpc('challenge_reminders');
  if (error) return json({ error: error.message }, 500);
  const due = (dueRows ?? []) as Due[];
  if (!due.length) return json({ sent: 0 });
  const { data: subRows, error: subError } = await db
    .from('challenge_push_subscriptions')
    .select('endpoint,user_id,p256dh,auth')
    .in(
      'user_id',
      due.map((d) => d.user_id),
    );
  if (subError) return json({ error: subError.message }, 500);

  let sent = 0,
    dropped = 0;
  const errors: string[] = [];
  for (const s of (subRows ?? []) as Sub[]) {
    const d = due.find((x) => x.user_id === s.user_id);
    if (!d) continue;
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(message(d)),
        { TTL: 3 * 3600 },
      );
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      // The device unsubscribed or the subscription expired: forget it.
      if (status === 404 || status === 410) {
        await db
          .from('challenge_push_subscriptions')
          .delete()
          .eq('endpoint', s.endpoint);
        dropped++;
      } else errors.push(`${d.name}: ${(e as Error).message}`);
    }
  }
  return json({ sent, dropped, errors, hour });
});
