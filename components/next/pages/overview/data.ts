import type { DateString, DayColor, Rule, World } from '@/lib/next/model';
import {
  dateIn,
  dateRange,
  dayColor,
  entryFor,
  entryPill,
  formatAnswer,
  formatDay,
  formatTime,
  formatWeekday,
  isClosed,
  lastDay,
  leader,
  lockTime,
  nameOf,
  openCheckins,
  openDay,
  pendingRequestFor,
  plural,
  pointOfEntry,
  reviewQueue,
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
  type PillStatus,
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

/** The day an item waiting for review is about. */
export const reviewDay = (item: ReviewItem) =>
  item.kind === 'forgiveness' ? item.point.day : item.entry.day;

export type WeekDay = {
  day: DateString;
  /** "Mon" */
  short: string;
  /** Day of the month, "16". */
  date: string;
  me: DayColor;
  partner: DayColor;
  today: boolean;
  /** Past days inside the challenge open a sheet with both people's answers. */
  opens: boolean;
};

const SHORT_DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
    /** The day being logged, "Thursday", and "Thursday, Nov 19". */
    day,
    dayName: day ? formatWeekday(day) : '',
    dayLong: day ? formatDay(day) : '',
    /** Check-ins Maya still has to answer for it. */
    open,
    left: open.length,
    /** Time left to log it, in ms, and "11:59 pm tonight". */
    msLeft: timeLeft(w),
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
    aheadLine:
      lead.personId === null
        ? 'You are tied'
        : lead.personId === w.me.id
          ? `You’re ahead by ${plural(lead.margin, 'point')}`
          : `${w.partner.name} is ahead by ${plural(lead.margin, 'point')}`,
    gym: gymWeek(w),
    streak: streakToProtect(w, w.me.id),
    partnerStreak: streakToProtect(w, w.partner.id),
    week: weekAround(w),
  };
}

export type Overview = ReturnType<typeof overviewOf>;

/* ── One day, for the day sheet ─────────────────────────────────────────── */

export type DayRow = {
  rule: Rule;
  title: string;
  /** "Yes", "No", "11,240 steps", or '' when nothing was logged. */
  answer: string;
  pill: { status: PillStatus; label: string };
  note: string;
  /** A dispute or a forgiveness request on this answer, in the other person's words or the owner's. */
  said?: { by: string; text: string };
};

export function dayRows(w: World, personId: string, day: DateString) {
  const mine = personId === w.me.id;
  const who = (id: string) => (id === w.me.id ? 'You' : nameOf(w, id));
  return rulesOn(w.challenge, personId, day).map((rule): DayRow => {
    const e = entryFor(w, personId, rule.id, day);
    const pill = entryPill(w, rule, e, day);
    const dispute = e
      ? w.disputes.find((d) => d.entryId === e.id && d.status === 'open')
      : undefined;
    const point = e ? pointOfEntry(w, e.id) : undefined;
    const request = point ? pendingRequestFor(w, point.id) : undefined;
    // "Waiting for review" says who it waits for.
    const label =
      pill.label === 'Waiting for review'
        ? mine
          ? `Waiting for ${w.partner.name}`
          : 'Waiting for you'
        : pill.label;
    // A plain Yes or No only matters while someone still has to look at it; "Done" and "Missed" say the rest.
    const showAnswer =
      !!e &&
      e.done !== null &&
      (rule.kind === 'number' ||
        pill.status === 'review' ||
        pill.status === 'disputed');
    return {
      rule,
      title: shortTitle(rule),
      answer: showAnswer && e ? formatAnswer(rule, e) : '',
      pill: { status: pill.status, label },
      note: e?.note ?? '',
      said: dispute
        ? { by: who(dispute.raisedBy), text: dispute.comment }
        : request
          ? { by: who(request.from), text: request.reason }
          : undefined,
    };
  });
}

/** What Maya can do about one day: log it (still open) and review what waits from it. */
export function dayActions(w: World, day: DateString) {
  const open = isClosed(w.challenge, day, w.now)
    ? 0
    : openCheckins(w, w.me.id, day).length;
  const review = reviewQueue(w, w.me.id).items.filter(
    (i) => reviewDay(i) === day,
  ).length;
  return { open, review };
}

/** Words for a day colour, for screen readers and the legend. */
export const COLOR_WORDS: Record<DayColor, string> = {
  done: 'Done',
  excused: 'Forgiven',
  missed: 'Missed',
  review: 'Waiting',
  open: 'Open',
  ahead: 'Not yet',
};
