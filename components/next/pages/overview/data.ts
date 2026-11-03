import type { DateString, DayColor, Rule, World } from '@/lib/next/model';
import {
  dateIn,
  dateRange,
  dayColor,
  dayMisses,
  formatDay,
  formatTime,
  formatWeekday,
  lastDay,
  leader,
  lockTime,
  openCheckins,
  openDay,
  plural,
  reviewQueue,
  answerLine,
  ruleIsFor,
  rulesFor,
  rulesOn,
  shift,
  standings,
  streakToProtect,
  timeLeft,
  waitingOnPartner,
  weekday,
  weekProgress,
  type ReviewItem,
} from '@/lib/next/selectors';

/**
 * Everything the Overview versions show, worked out from the sample world with the shared
 * selectors. All three versions read the same numbers from here, so they only differ in layout.
 */

/** "Social media and games" from "Social media and games, 60 min or less". */
export const shortTitle = (rule: Pick<Rule, 'title'>) =>
  rule.title.split(', ')[0];

/** "11:59 pm tonight", "9:00 am tomorrow" or "11:59 pm Saturday": when a day's logging closes. */
function closesAt(w: World, lock: number) {
  const c = w.challenge,
    on = dateIn(c.timeZone, lock),
    time = formatTime(lock, c.timeZone);
  if (on === w.today)
    return `${time} ${Number(c.deadline.time.slice(0, 2)) >= 17 ? 'tonight' : 'today'}`;
  if (on === shift(w.today, 1)) return `${time} tomorrow`;
  return `${time} ${formatWeekday(on)}`;
}

/** "2 answers, 1 forgiveness request, 1 dispute" */
export function reviewSummary(items: ReviewItem[]) {
  const count = (kind: ReviewItem['kind']) =>
    items.filter((i) => i.kind === kind).length;
  return [
    [count('answer'), 'answer'],
    [count('correction'), 'late answer'],
    [count('forgiveness'), 'forgiveness request'],
    [count('dispute'), 'dispute'],
  ]
    .filter(([n]) => (n as number) > 0)
    .map(([n, word]) => plural(n as number, word as string))
    .join(', ');
}

export type WeekDay = {
  day: DateString;
  /** "Mon" */
  short: string;
  /** Day of the month, "16". */
  date: string;
  me: DayColor;
  partner: DayColor;
  /** On a missed day, how many of its check-ins each missed ("1 of 8"); null otherwise. */
  meMisses: Misses | null;
  partnerMisses: Misses | null;
  today: boolean;
  /** Past days inside the challenge open a sheet with both people's answers. */
  opens: boolean;
};

const SHORT_DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type Misses = ReturnType<typeof dayMisses>;

/** A missed day's count, or null when the day isn't a missed one. */
const missesOn = (w: World, personId: string, day: DateString) =>
  dayColor(w, personId, day) === 'missed' ? dayMisses(w, personId, day) : null;

/** The calendar week around today (Monday to Sunday), with both people's day colours. */
function weekAround(w: World): WeekDay[] {
  const c = w.challenge,
    back = (weekday(w.today) - c.weekStart + 7) % 7,
    start = shift(w.today, -back);
  return dateRange(start, shift(start, 6)).map((day) => ({
    day,
    short: SHORT_DAY[weekday(day)],
    date: String(Number(day.slice(8))),
    me: dayColor(w, w.me.id, day),
    partner: dayColor(w, w.partner.id, day),
    meMisses: missesOn(w, w.me.id, day),
    partnerMisses: missesOn(w, w.partner.id, day),
    today: day === w.today,
    opens: day < w.today && day >= c.start && day <= lastDay(c),
  }));
}

/** Gym (the challenge's weekly rule) this week, for both people. */
function gymWeek(w: World) {
  const rule = rulesFor(w.challenge, w.me.id).find((r) => r.kind === 'weekly');
  if (!rule) return null;
  const mine = weekProgress(w, w.me.id, rule.id);
  const theirs = ruleIsFor(rule, w.partner.id)
    ? weekProgress(w, w.partner.id, rule.id)
    : null;
  return mine
    ? { rule, name: shortTitle(rule), me: mine, partner: theirs }
    : null;
}

/**
 * A day as Overview names it under today's date: "yesterday" (or "today"), otherwise its weekday
 * ("Wednesday"), so the title and the button never name the same day two ways.
 */
const relativeDay = (w: World, day: DateString) =>
  day === shift(w.today, -1)
    ? 'yesterday'
    : day === w.today
      ? 'today'
      : formatWeekday(day);

export function overviewOf(w: World) {
  const c = w.challenge,
    day = openDay(w);
  const open = openCheckins(w, w.me.id);
  const queue = reviewQueue(w, w.me.id);
  const [mine, theirs] = standings(w);
  const lead = leader(w);
  const partnerOpen = openCheckins(w, w.partner.id);
  return {
    today: formatDay(w.today),
    /** The day being logged, and its name to someone reading today's date: "yesterday" or "Wednesday". */
    day,
    dayName: day ? relativeDay(w, day) : '',
    /** Check-ins Maya still has to answer for it. */
    open,
    left: open.length,
    /** Time left to log it, in ms, and "11:59 pm tonight". */
    msLeft: timeLeft(w),
    /** Day 1, before anything can be logged: when today is answered, and today's check-ins. */
    firstDay: !day && w.today === c.start,
    answerToday: answerLine(w, w.today),
    todayRules: rulesOn(c, w.me.id, w.today),
    closes: day ? closesAt(w, lockTime(c, day)) : '',
    /** What waits for Maya: Jordan's answers, requests, and disputes on her answers. */
    queue,
    waiting: queue.count,
    waitingSummary: reviewSummary(queue.items),
    /** Jordan has answered everything for the open day. */
    partnerDone: !!day && partnerOpen.length === 0,
    partnerLeft: partnerOpen.length,
    /** Maya's own answers still waiting for Jordan. */
    onPartner: waitingOnPartner(w, w.me.id).count,
    mine,
    theirs,
    /** Who has fewer points, and by how many. */
    lead,
    /** Both numbers, then who's ahead (points are misses, so fewer is ahead): "6 points to Jordan's 9 · you're ahead". */
    aheadLine:
      lead.personId === null
        ? `${plural(mine.points, 'point')} each · tied`
        : `${plural(mine.points, 'point')} to ${w.partner.name}’s ${theirs.points} · ${
            lead.personId === w.me.id ? 'you’re' : `${w.partner.name}’s`
          } ahead`,
    gym: gymWeek(w),
    streak: streakToProtect(w, w.me.id),
    partnerStreak: streakToProtect(w, w.partner.id),
    week: weekAround(w),
  };
}

export type Overview = ReturnType<typeof overviewOf>;

/** Words for a day colour, for screen readers and the legend. */
export const COLOR_WORDS: Record<DayColor, string> = {
  done: 'Done',
  excused: 'Forgiven',
  missed: 'Missed',
  review: 'Waiting',
  open: 'Open',
  ahead: 'Not yet',
};
