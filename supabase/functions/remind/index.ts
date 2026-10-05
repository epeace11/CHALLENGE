// Supabase Edge Function (Deno), called every hour by pg_cron (supabase/push-reminders-schedule.sql).
// At the reminder hours it sends one web push to each member who still has unlogged daily habits for
// the day that locks at 11:59 pm tonight. At WEEKLY_AT, with two days or fewer left in the week, it
// also nudges anyone still short of a weekly target (gym, steps). Deploy with
//   supabase functions deploy remind --no-verify-jwt --project-ref llctyiwwcytwmemmnrvw
// Secrets (supabase/functions/.env): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, REMIND_SECRET.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

/** Toronto hours at which a reminder goes out when something is still unlogged. */
const REMIND_AT = [20, 22];
/** Toronto hour for the weekly-target nudge on the last two days of a week. */
const WEEKLY_AT = 17;
const TIME_ZONE = 'America/Toronto';

type Due = {
  user_id: string;
  name: string;
  day: string;
  missing: number;
  titles: string[];
};
type WeeklyDue = {
  user_id: string;
  name: string;
  rule_id: string;
  title: string;
  have: number;
  target: number;
  days_left: number;
};
type Note = { title: string; body: string; tag: string; url: string };
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

/** Short names for the weekly rules, like weeklyLabel in lib/rules.ts. */
const LABEL: Record<string, string> = { gym: 'Gym', steps_weekly: 'Steps' };

/** One nudge per member covering each weekly target still short: "Gym: 2 of 4, 2 visits to go". */
function weeklyMessage(rows: WeeklyDue[]): Note {
  const left = rows[0].days_left,
    parts = rows.map((r) => {
      const unit = r.rule_id === 'gym' ? 'visit' : 'day',
        need = r.target - r.have;
      return `${LABEL[r.rule_id] ?? r.title}: ${r.have} of ${r.target}, ${need} ${unit}${need === 1 ? '' : 's'} to go`;
    });
  return {
    title: left === 1 ? 'Last day of the week' : '2 days left this week',
    body: `${parts.join('. ')}.`,
    tag: `weekly-${rows[0].rule_id}-${left}`,
    url: '/',
  };
}

function message(d: Due): Note {
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
  const daily = force || REMIND_AT.includes(hour),
    weekly = force || hour === WEEKLY_AT;
  if (!daily && !weekly) return json({ sent: 0, skipped: `hour ${hour}` });

  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT') ?? 'https://thechallenge.win',
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!,
  );
  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  // Each member's notifications this hour.
  const notes = new Map<string, { name: string; notes: Note[] }>();
  const add = (uid: string, name: string, note: Note) => {
    const n = notes.get(uid) ?? { name, notes: [] };
    n.notes.push(note);
    notes.set(uid, n);
  };
  if (daily) {
    const { data, error } = await db.rpc('challenge_reminders');
    if (error) return json({ error: error.message }, 500);
    for (const d of (data ?? []) as Due[]) add(d.user_id, d.name, message(d));
  }
  if (weekly) {
    const { data, error } = await db.rpc('challenge_weekly_reminders');
    if (error) return json({ error: error.message }, 500);
    const rows = (data ?? []) as WeeklyDue[];
    for (const uid of new Set(rows.map((r) => r.user_id))) {
      const mine = rows.filter((r) => r.user_id === uid);
      add(uid, mine[0].name, weeklyMessage(mine));
    }
  }
  if (!notes.size) return json({ sent: 0 });
  const { data: subRows, error: subError } = await db
    .from('challenge_push_subscriptions')
    .select('endpoint,user_id,p256dh,auth')
    .in('user_id', [...notes.keys()]);
  if (subError) return json({ error: subError.message }, 500);

  let sent = 0,
    dropped = 0;
  const errors: string[] = [];
  subs: for (const s of (subRows ?? []) as Sub[]) {
    const d = notes.get(s.user_id);
    if (!d) continue;
    for (const note of d.notes)
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(note),
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
          continue subs;
        }
        errors.push(`${d.name}: ${(e as Error).message}`);
      }
  }
  return json({ sent, dropped, errors, hour });
});
