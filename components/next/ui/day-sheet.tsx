'use client';
import { createElement, type ReactNode } from 'react';
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Dumbbell,
  Footprints,
  House,
  Moon,
  PiggyBank,
  Smartphone,
  Utensils,
  Wine,
  type LucideIcon,
} from 'lucide-react';
import type {
  DateString,
  DayColor,
  Entry,
  Rule,
  World,
} from '@/lib/next/model';
import {
  dateIn,
  dayColor,
  entryFor,
  entryPill,
  formatAnswer,
  formatDate,
  formatDay,
  formatTime,
  isClosed,
  lockTime,
  nameOf,
  openCheckins,
  pendingRequestFor,
  reviewQueue,
  ruleById,
  rulesOn,
  weekOf,
  weekProgress,
  type PillStatus,
} from '@/lib/next/selectors';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Card } from './card';
import { DayIcon } from './day';
import { PersonChip } from './people';
import { StatusPill } from './pill';
import { ProofStrip } from './proofs';

/**
 * One day's check-ins, the same wherever a day opens (Overview's week, the Progress calendar): You
 * and partner chips, each with that person's day square, then that person's check-ins as rows with
 * the habit's icon, its name, how it stands and a chevron. A row leads where you would act on it:
 * Check in while it is open, Review while something on it waits for you (or to ask your partner to
 * forgive a miss of yours), otherwise into the check-in itself. Both people's rows are laid out
 * on top of each other, so switching chips never changes the sheet's height.
 *
 * Pages put these in their own `Sheet`: `DayCheckins` for the day, `CheckinDetail` for one check-in
 * (stepped into with `back`), and `dayFooter` for the buttons.
 */

/** Where a sheet's buttons and rows send you. */
export type DayPage = 'log' | 'review';

/** Joins facts so a wrapped line ends with the dot instead of starting with it. */
const DOT = '\u00a0· ';

/** An icon for a habit, by what it is about. */
export function habitIcon(rule: Rule): LucideIcon {
  switch (rule.group) {
    case 'Sleep':
      return Moon;
    case 'Screens':
      return Smartphone;
    case 'Food':
      return Utensils;
    case 'Drinks':
      return Wine;
    case 'Movement':
      return rule.kind === 'weekly' ? Dumbbell : Footprints;
    case 'Mind':
      return BookOpen;
    case 'Money':
      return PiggyBank;
    default:
      return House;
  }
}

/** The check-ins of one day for one person, with each answer's pill. */
export function dayCheckins(w: World, personId: string, day: DateString) {
  return rulesOn(w.challenge, personId, day).map((rule) => {
    const entry = entryFor(w, personId, rule.id, day);
    return { rule, entry, pill: entryPill(w, rule, entry, day) };
  });
}

/** What waits on the viewer from one person, narrowed to a day or a habit. */
export function waitingOn(
  w: World,
  personId: string,
  match: { day?: DateString; ruleId?: string },
) {
  return reviewQueue(w, w.me.id).items.filter((item) => {
    const day = item.kind === 'forgiveness' ? item.point.day : item.entry.day;
    const owner =
      item.kind === 'forgiveness' ? item.point.personId : item.entry.personId;
    return (
      owner === personId &&
      (match.day === undefined || day === match.day) &&
      (match.ruleId === undefined || item.rule.id === match.ruleId)
    );
  });
}

/** The point a check-in carries (forgiven or not), if it has one. */
const pointOn = (w: World, personId: string, ruleId: string, day: DateString) =>
  w.points.find(
    (p) =>
      p.personId === personId &&
      p.ruleId === ruleId &&
      p.day === day &&
      !p.voided,
  );

/**
 * Where a check-in's row leads: Check in while the viewer's own check-in is open; Review while
 * something on it waits for the viewer, or when it is the viewer's miss with nothing asked yet
 * (`ask`: asking the partner to forgive it happens on Review); otherwise the check-in itself.
 */
export function rowLeadsTo(
  w: World,
  personId: string,
  ruleId: string,
  day: DateString,
  status: PillStatus,
): { to: DayPage | 'checkin'; ask: boolean } {
  const mine = personId === w.me.id;
  if (mine && status === 'open') return { to: 'log', ask: false };
  if (waitingOn(w, personId, { day, ruleId }).length > 0)
    return { to: 'review', ask: false };
  const point =
    mine && status === 'missed' && pointOn(w, personId, ruleId, day);
  if (point && !point.forgiven && !pendingRequestFor(w, point.id))
    return { to: 'review', ask: true };
  return { to: 'checkin', ask: false };
}

/**
 * The buttons under a day (or one of its check-ins, with `only`): Log this day while the viewer has
 * check-ins open on it, and Open Review while something from it waits for them. The same whichever
 * chip is chosen, so the sheet keeps its height. Undefined when there is nothing to do: the sheet's
 * close button is enough.
 */
export function dayFooter(
  w: World,
  day: DateString,
  onGo: (page: DayPage) => void,
  only?: { personId: string; ruleId: string },
): ReactNode {
  const log =
    (!only || only.personId === w.me.id) &&
    !isClosed(w.challenge, day, w.now) &&
    openCheckins(w, w.me.id, day).some((r) => !only || r.id === only.ruleId);
  const review = only
    ? waitingOn(w, only.personId, { day, ruleId: only.ruleId }).length > 0
    : [w.me.id, w.partner.id].some((id) => waitingOn(w, id, { day }).length);
  if (!log && !review) return undefined;
  // Two buttons sit side by side on phones too, so the day's rows keep the room.
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-2.5 sm:flex sm:justify-end">
      {review && (
        <Button
          variant={log ? 'secondary' : 'primary'}
          iconEnd={log ? undefined : ArrowRight}
          onClick={() => onGo('review')}
        >
          Open Review
        </Button>
      )}
      {/* The sheet's title names the day, so the button doesn't again. */}
      {log && (
        <Button
          variant="primary"
          iconEnd={ArrowRight}
          onClick={() => onGo('log')}
        >
          Log this day
        </Button>
      )}
    </div>
  );
}

/** The line under a check-in's title: whose it is (the partner's) and its day. */
export const checkinLine = (w: World, personId: string, day: DateString) =>
  [personId === w.me.id ? '' : nameOf(w, personId), formatDay(day)]
    .filter(Boolean)
    .join(' · ');

const DAY_WORDS: Record<DayColor, string> = {
  done: 'done',
  excused: 'forgiven',
  missed: 'missed',
  review: 'waiting',
  open: 'open',
  ahead: 'not yet',
};

/**
 * The answer worth showing beside a check-in's pill: a number ("48 min"), or a Yes or No only while
 * someone still has to look at it. An open check-in has none, and a Yes beside Done (or a No beside
 * Missed or Forgiveness asked) would say the same thing twice.
 */
function shownAnswer(
  rule: Rule,
  entry: Entry | undefined,
  pill: { status: PillStatus; label: string },
) {
  if (pill.status === 'open' || !entry) return '';
  const answer = formatAnswer(rule, entry);
  const plain =
    rule.kind === 'yesno' &&
    (pill.status === 'done' ||
      pill.status === 'missed' ||
      pill.label === 'Forgiveness asked');
  return answer !== pill.label && !plain ? answer : '';
}

/** "Open until 11:59 pm tonight" while the day can still be logged. */
function openUntil(w: World, day: DateString) {
  const c = w.challenge;
  if (day >= w.today || isClosed(c, day, w.now)) return null;
  const lock = lockTime(c, day),
    time = formatTime(lock, c.timeZone);
  return dateIn(c.timeZone, lock) === w.today
    ? `Open until ${time} tonight`
    : `Open until ${time}`;
}

/** Whether a day is in this week, for a weekly habit's count: "2 of 4 this week", "4 of 4 that week". */
function weekWord(w: World, day: DateString) {
  const week = weekOf(w.challenge, day);
  return week && w.today >= week.start && w.today <= week.end
    ? 'this week'
    : 'that week';
}

export function DayCheckins({
  world,
  day,
  personId,
  onPerson,
  onOpen,
  onGo,
}: {
  world: World;
  day: DateString;
  /** Whose check-ins show; the chips switch it. */
  personId: string;
  onPerson: (personId: string) => void;
  /** Steps into one check-in. */
  onOpen: (personId: string, ruleId: string) => void;
  /** Leaves the sheet for Check in or Review. */
  onGo: (page: DayPage) => void;
}) {
  const people = [world.me, world.partner];
  const open = openUntil(world, day);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <fieldset className="flex gap-2">
          <legend className="sr-only">Whose check-ins</legend>
          {people.map((p) => {
            const tone = dayColor(world, p.id, day);
            return (
              <PersonChip
                key={p.id}
                person={p}
                pressed={p.id === personId}
                onClick={() => onPerson(p.id)}
              >
                <span className="inline-flex items-center gap-2">
                  {p.id === world.me.id ? 'You' : p.name}
                  <span
                    className="nx-day size-5 rounded-md"
                    data-tone={tone}
                    aria-hidden="true"
                  >
                    <DayIcon tone={tone} size={12} />
                  </span>
                  <span className="sr-only">{`: ${DAY_WORDS[tone]}`}</span>
                </span>
              </PersonChip>
            );
          })}
        </fieldset>
        {open && <p className="text-nx-2 text-nx-ink-2 sm:ml-auto">{open}</p>}
      </div>
      {/* Both people's check-ins in one cell, the other one hidden, so the sheet is as tall for
          either chip. */}
      <div className="grid">
        {people.map((p) => {
          const shown = p.id === personId;
          return (
            <div
              key={p.id}
              className={cn(
                'col-start-1 row-start-1 min-w-0 transition-[opacity,visibility] duration-200 ease-nx',
                shown ? 'visible opacity-100' : 'invisible opacity-0',
              )}
              inert={!shown}
              aria-hidden={!shown || undefined}
            >
              <PersonDay
                world={world}
                personId={p.id}
                day={day}
                onOpen={(ruleId) => onOpen(p.id, ruleId)}
                onGo={onGo}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * One person's check-ins on a day, daily ones first and weekly ones last with the week's count, in
 * one list; then their notes.
 */
function PersonDay({
  world,
  personId,
  day,
  onOpen,
  onGo,
}: {
  world: World;
  personId: string;
  day: DateString;
  onOpen: (ruleId: string) => void;
  onGo: (page: DayPage) => void;
}) {
  const rows = dayCheckins(world, personId, day);
  const daily = rows.filter((r) => r.rule.kind !== 'weekly');
  const weekly = rows.filter((r) => r.rule.kind === 'weekly');
  const notes = world.journal
    .filter((n) => n.day === day && n.personId === personId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const mine = personId === world.me.id;
  // "Waiting for review" says who it waits for.
  const pillLabel = (label: string) =>
    label === 'Waiting for review'
      ? mine
        ? `Waiting for ${world.partner.name}`
        : 'Waiting for you'
      : label;
  const row = (
    { rule, entry, pill }: (typeof rows)[number],
    sub: string,
    label: string,
  ) => {
    const lead = rowLeadsTo(world, personId, rule.id, day, pill.status);
    return (
      <CheckinRow
        key={rule.id}
        rule={rule}
        sub={sub}
        ask={lead.ask ? `Ask ${world.partner.name} to forgive it` : undefined}
        pill={<StatusPill status={pill.status} label={label} />}
        goes={lead.to}
        onClick={() =>
          lead.to === 'checkin' ? onOpen(rule.id) : onGo(lead.to)
        }
        note={entry?.note}
      />
    );
  };
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-nx-line">
        {daily.map((r) => {
          const { rule, entry, pill } = r;
          return row(r, shownAnswer(rule, entry, pill), pillLabel(pill.label));
        })}
        {weekly.map((r) => {
          const week = weekProgress(world, personId, r.rule.id, day);
          const label =
            r.pill.status === 'done'
              ? 'Went'
              : r.pill.status === 'none'
                ? 'No visit'
                : pillLabel(r.pill.label);
          return row(
            r,
            week ? `${week.have} of ${week.need} ${weekWord(world, day)}` : '',
            label,
          );
        })}
      </ul>
      {notes.length > 0 && (
        <section className="flex flex-col gap-1" aria-label="Notes">
          <h3 className="font-nx-sans text-nx-2 font-semibold text-nx-ink-2">
            Notes
          </h3>
          {notes.map((n) => (
            <p key={n.id} className="text-pretty text-nx-body">
              {n.text}{' '}
              <span className="text-nx-2 whitespace-nowrap text-nx-ink-2">
                {formatTime(n.createdAt, world.challenge.timeZone)}
              </span>
            </p>
          ))}
        </section>
      )}
    </div>
  );
}

/**
 * One check-in in a day's list, a single line where it fits: the habit's icon and name (a number
 * answer or the note under it), how it stands, and a chevron.
 */
function CheckinRow({
  rule,
  sub,
  note,
  ask,
  pill,
  goes,
  onClick,
}: {
  rule: Rule;
  sub: string;
  note?: string;
  /** "Ask Jordan to forgive it", on a miss of yours that Review can ask about. */
  ask?: string;
  pill: ReactNode;
  goes: DayPage | 'checkin';
  onClick: () => void;
}) {
  const line = [sub, note ? `“${note}”` : ''].filter(Boolean).join(DOT);
  const where =
    goes === 'log' ? 'Opens Check in' : goes === 'review' ? 'Opens Review' : '';
  return (
    <li>
      <button
        type="button"
        className="nx-press flex min-h-12 w-full items-center gap-2.5 py-1.5 text-left"
        onClick={onClick}
      >
        <span className="shrink-0 text-nx-accent">
          {createElement(habitIcon(rule), { size: 20, 'aria-hidden': true })}
        </span>
        {/* From 640px the answer ("48 min") follows the name on its line. */}
        <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-3">
          <span className="text-pretty text-nx-body font-semibold text-nx-ink">
            {rule.title}
          </span>
          {(line || ask) && (
            <span className="text-pretty text-nx-2 text-nx-ink-2">
              {line}
              {line && ask && DOT}
              {ask && (
                <span className="font-semibold text-nx-accent">{ask}</span>
              )}
            </span>
          )}
        </span>
        {pill}
        {where && <span className="sr-only">{`. ${where}`}</span>}
        <ChevronRight
          size={20}
          aria-hidden="true"
          className="shrink-0 text-nx-accent"
        />
      </button>
    </li>
  );
}

/**
 * One check-in on one day: the answer and how it stands, its screenshots (tap for full screen), the
 * note, a late correction, a dispute or a forgiveness request on it, and when it was logged. With
 * `onHabit`, a way on to every day of that habit.
 */
export function CheckinDetail({
  world,
  personId,
  ruleId,
  day,
  onHabit,
}: {
  world: World;
  personId: string;
  ruleId: string;
  day: DateString;
  onHabit?: () => void;
}) {
  const rule = ruleById(world.challenge, ruleId);
  if (!rule) return null;
  const entry = entryFor(world, personId, ruleId, day);
  const pill = entryPill(world, rule, entry, day);
  const shown = shownAnswer(rule, entry, pill);
  const disputes = entry
    ? world.disputes.filter((d) => d.entryId === entry.id)
    : [];
  const point = pointOn(world, personId, ruleId, day);
  const requests = point
    ? world.requests.filter((r) => r.pointId === point.id)
    : [];
  // A reason often starts with the note; then the note isn't shown again.
  const note =
    entry?.note && !requests.some((r) => r.reason.includes(entry.note.trim()))
      ? entry.note
      : '';
  const tz = world.challenge.timeZone;
  const who = (id: string) => (id === world.me.id ? 'You' : nameOf(world, id));
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {shown && <span className="text-nx-lead font-semibold">{shown}</span>}
        <StatusPill status={pill.status} label={pill.label} />
      </div>
      {entry && entry.proofs.length > 0 && <ProofStrip proofs={entry.proofs} />}
      {note && (
        <Card pad="sm">
          <p className="text-nx-body">{note}</p>
        </Card>
      )}
      {entry?.correction && (
        <Card pad="sm" className="flex flex-col gap-2">
          <p className="text-nx-2 font-semibold text-nx-ink-2">
            Late correction, waiting for review
          </p>
          <p className="text-nx-body">
            {formatAnswer(rule, { ...entry, ...entry.correction })}
            {entry.correction.note ? ` · ${entry.correction.note}` : ''}
          </p>
          {entry.correction.proofs.length > 0 && (
            <ProofStrip proofs={entry.correction.proofs} />
          )}
        </Card>
      )}
      {disputes.map((d) => (
        <Card key={d.id} pad="sm" className="flex flex-col gap-1.5">
          <p className="text-nx-2 font-semibold text-nx-ink-2">
            {who(d.raisedBy)} disputed it
            {d.status === 'conceded'
              ? ' · conceded'
              : d.status === 'withdrawn'
                ? ' · withdrawn'
                : ''}
          </p>
          <p className="text-nx-body">“{d.comment}”</p>
          {d.reply && (
            <p className="text-nx-body text-nx-ink-2">Reply: “{d.reply}”</p>
          )}
        </Card>
      ))}
      {requests.map((r) => (
        <Card key={r.id} pad="sm" className="flex flex-col gap-1.5">
          <p className="text-nx-2 font-semibold text-nx-ink-2">
            {who(r.from)} asked to forgive it
            {r.status === 'approved'
              ? ' · forgiven'
              : r.status === 'denied'
                ? ' · declined'
                : ''}
          </p>
          <p className="text-nx-body">“{r.reason}”</p>
        </Card>
      ))}
      {entry?.loggedAt && (
        <p className="text-nx-2 text-nx-ink-2">
          Logged {formatDate(dateIn(tz, entry.loggedAt))} at{' '}
          {formatTime(entry.loggedAt, tz)}
        </p>
      )}
      {onHabit && (
        <Button
          variant="quiet"
          iconEnd={ChevronRight}
          className="-ml-3 self-start"
          onClick={onHabit}
        >
          Every day of this habit
        </Button>
      )}
    </div>
  );
}
