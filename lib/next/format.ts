import type {
  DateString,
  Deadline,
  Instant,
  Rule,
  Target,
  Weekday,
} from './model.ts';
import { ms } from './calendar.ts';

/** Plain-English wording for dates, money, targets and deadlines. Fixed locale (en-US), so output never depends on the device. */

const dateFormat = (o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-US', { ...o, timeZone: 'UTC' });
const at = (d: DateString) => new Date(d + 'T12:00:00Z');
const longDay = dateFormat({ weekday: 'long', month: 'short', day: 'numeric' }),
  shortDay = dateFormat({ weekday: 'short', month: 'short', day: 'numeric' }),
  monthDay = dateFormat({ month: 'short', day: 'numeric' }),
  monthDayYear = dateFormat({
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }),
  weekdayName = dateFormat({ weekday: 'long' });

/** "Thursday, Nov 19" */
export const formatDay = (d: DateString) => longDay.format(at(d));
/** "Thu, Nov 19" */
export const formatDayShort = (d: DateString) => shortDay.format(at(d));
/** "Nov 19" */
export const formatDate = (d: DateString) => monthDay.format(at(d));
/** "Nov 19, 2026" */
export const formatDateYear = (d: DateString) => monthDayYear.format(at(d));
/** "Thursday" */
export const formatWeekday = (d: DateString) => weekdayName.format(at(d));

/** "Nov 2 – Dec 1", or "Nov 9 – 15" inside one month. */
export function formatRange(from: DateString, to: DateString) {
  if (from.slice(0, 7) === to.slice(0, 7))
    return `${formatDate(from)} – ${Number(to.slice(8))}`;
  return `${formatDate(from)} – ${formatDate(to)}`;
}

/** "11,240"; decimals only when there are any ("3.8"). */
export const formatNumber = (n: number) =>
  n.toLocaleString('en-US', { maximumFractionDigits: 2 });

/** "$45", "$0.25", "$1,234.50": cents only when there are any. */
export function formatMoney(dollars: number) {
  const whole = Math.abs(dollars - Math.round(dollars)) < 0.005;
  return (
    (dollars < 0 ? '-$' : '$') +
    Math.abs(dollars).toLocaleString('en-US', {
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
    })
  );
}

/** "1 point", "6 points". Pass `many` when adding "s" is wrong. */
export const plural = (n: number, one: string, many = one + 's') =>
  `${formatNumber(n)} ${n === 1 ? one : many}`;

const SHORT: Record<Weekday, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

/** "Every day", "Sun–Thu", "Mon–Fri", "Weekends", or a list ("Mon, Wed, Fri"). */
export function formatWeekdays(days: Weekday[]) {
  const set = [...new Set(days)].sort((a, b) => a - b);
  if (set.length === 7) return 'Every day';
  if (set.length === 2 && set[0] === 0 && set[1] === 6) return 'Weekends';
  if (set.length === 0) return 'No days';
  // A run of consecutive days, possibly wrapping past Saturday (Sun–Thu is 0–4; Fri–Mon wraps).
  for (let s = 0; s < 7; s++) {
    const run = Array.from(
      { length: set.length },
      (_, i) => ((s + i) % 7) as Weekday,
    );
    if (set.length >= 2 && run.every((d) => set.includes(d)))
      return `${SHORT[run[0]]}–${SHORT[run[run.length - 1]]}`;
  }
  return set.map((d) => SHORT[d]).join(', ');
}

/** "60 min or less", "10,000 steps or more". */
export const formatTarget = (t: Target) =>
  `${formatNumber(t.value)} ${t.unit} ${t.op === '<=' ? 'or less' : 'or more'}`;

/** A logged number with its unit: "11,240 steps", "48 min", "3.8 L". */
export const formatValue = (rule: Pick<Rule, 'target'>, value: number) =>
  `${formatNumber(value)}${rule.target ? ` ${rule.target.unit}` : ''}`;

/** When a rule is asked: "Sun–Thu", "Every day" or "4 days a week". */
export function formatWhen(rule: Rule) {
  if (rule.kind === 'weekly') {
    const n = rule.weeklyTarget ?? 0;
    return `${plural(n, 'day')} a week`;
  }
  return formatWeekdays(rule.days);
}

/** "7:30 pm" in `timeZone`. */
export function formatTime(instant: Instant | number, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  })
    .format(new Date(ms(instant)))
    .replace(/\s?([AP])M$/, (_, x: string) => ` ${x.toLowerCase()}m`);
}

/** "11:59 pm the next day". */
export function formatDeadline(d: Deadline) {
  const [h, m] = d.time.split(':').map(Number);
  const clock = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
  const when =
    d.daysAfter === 0
      ? 'the same day'
      : d.daysAfter === 1
        ? 'the next day'
        : `${d.daysAfter} days later`;
  return `${clock} ${when}`;
}

/** Time left as "4h 29m", "29m" or "2d 3h"; "0m" once it has run out. */
export function formatDuration(msLeft: number) {
  const minutes = Math.max(0, Math.floor(msLeft / 6e4)),
    days = Math.floor(minutes / 1440),
    hours = Math.floor((minutes % 1440) / 60),
    mins = minutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}
