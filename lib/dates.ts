/** Calendar dates are 'YYYY-MM-DD' strings in Toronto time; instants are epoch milliseconds. */

/** The challenge's first and last day. Every other date in the app is derived from these; the database holds the same pair in challenge_config. */
export const START = '2026-09-15',
  END = '2026-10-14';

const TIME_ZONE = 'America/Toronto';

/** Today's date in Toronto. */
export function toronto(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** `date` moved by `n` days. */
export function shift(date: string, n: number) {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function clampDate(d: string) {
  return d < START ? START : d > END ? END : d;
}

/** The day the Log page opens on: yesterday, kept inside the challenge. */
export function defaultDate(now = new Date()) {
  return clampDate(shift(toronto(now), -1));
}

/** 0 = Sunday … 6 = Saturday. */
export const dayOfWeek = (date: string) =>
  new Date(date + 'T12:00Z').getUTCDay();

/** Every date from `from` to `to`, inclusive. */
export function days(from = START, to = END) {
  const out: string[] = [];
  for (let d = from; d <= to; d = shift(d, 1)) out.push(d);
  return out;
}

/** Days left in the challenge, today included (0 once it is over). */
export const daysLeft = (today: string) =>
  Math.min(
    30,
    Math.max(
      0,
      Math.round(
        (Date.parse(END + 'T00:00Z') - new Date(today + 'T00:00Z').getTime()) /
          864e5,
      ) + 1,
    ),
  );

/** "Wednesday, Sep 23" */
export function formatDate(d: string) {
  return new Date(d + 'T12:00Z').toLocaleDateString('en-CA', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** "Sep 23": formatDate without the weekday. */
export const formatShortDate = (d: string) =>
  formatDate(d).replace(/^\w+, /, '');

/** "3:05 PM", Toronto time. */
export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  });
}

const upperShort = (d: string) =>
  new Date(d + 'T12:00Z')
    .toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    })
    .toUpperCase();
/** "SEP 15 – OCT 14" */
export const challengeRange = `${upperShort(START)} – ${upperShort(END)}`;

/** Instant (ms) when logging for `date` locks: 11:59 pm the next day, Toronto time, DST-aware. */
export function lockTime(date: string) {
  const next = shift(date, 1);
  let guess = Date.UTC(
    +next.slice(0, 4),
    +next.slice(5, 7) - 1,
    +next.slice(8, 10),
    23,
    59,
  );
  for (let i = 0; i < 2; i++) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(new Date(guess));
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    const localDay = `${get('year')}-${get('month')}-${get('day')}`,
      hour = Number(get('hour'));
    const dayDiff =
      (Date.UTC(
        +localDay.slice(0, 4),
        +localDay.slice(5, 7) - 1,
        +localDay.slice(8, 10),
      ) -
        Date.UTC(
          +next.slice(0, 4),
          +next.slice(5, 7) - 1,
          +next.slice(8, 10),
        )) /
      864e5;
    guess -= (dayDiff * 24 + hour - 23) * 36e5;
  }
  return guess;
}

/** "3h 12m" style time until `date` locks, or null once past. */
export function untilLock(date: string, now = Date.now()) {
  const ms = lockTime(date) - now;
  if (ms <= 0) return null;
  const h = Math.floor(ms / 36e5),
    m = Math.floor((ms % 36e5) / 6e4);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** True once `date`'s logging deadline has passed. */
export const closed = (date: string, now: number) => now > lockTime(date);
