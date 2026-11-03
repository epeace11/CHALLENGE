'use client';
import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { CheckCheck, ChevronRight, Expand, Undo2, X } from 'lucide-react';
import type { Person, Proof, Rule, World } from '@/lib/next/model';
import {
  formatAnswer,
  formatDay,
  formatDayShort,
  formatMoney,
  formatNumber,
  formatTarget,
  formatWeekday,
  meetsTarget,
  openCheckins,
  openDay,
  titleSays,
  whenUnlessTitled,
} from '@/lib/next/selectors';
import { useNav } from '@/components/next/nav';
import {
  Avatar,
  Button,
  Card,
  DURATION,
  EASE,
  GlassCard,
  ProofViewer,
  RowButton,
  ReasonSheet,
  Sheet,
} from '@/components/next/ui';
import { cn } from '@/lib/utils';
import { STAMP } from './motion';
import {
  approveAllLabel,
  concedeEffect,
  forgiveEffect,
  missWhy,
  shownAnswer,
  waitingSummary,
  type AnswerItem,
  type DayGroup,
  type DisputeItem,
  type ForgiveItem,
  type LateItem,
  type ReviewItem,
  type Shown,
} from './queue';
import type { Held, Pause, Review } from './use-review';

/* ── Hooks ─────────────────────────────────────────────────────────────── */

/**
 * A sheet about one thing. The thing stays set while the sheet closes, so its content does not
 * vanish mid-animation; `show` points the sheet at a new thing and opens it.
 */
export type SheetFor<T> = {
  target: T | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  show: (next: T) => void;
};

export function useSheetFor<T>(): SheetFor<T> {
  const [target, setTarget] = useState<T | null>(null);
  const [open, setOpen] = useState(false);
  return {
    target,
    open,
    setOpen,
    show: (next: T) => {
      setTarget(next);
      setOpen(true);
    },
  };
}

/**
 * Moves focus after a decision, once no sheet is left on screen (a closing sheet hands focus back
 * to whatever opened it as it goes, so this waits for that first). `focusLater(find)` focuses what
 * `find` returns then; returning nothing leaves focus where it is.
 */
export function useFocusLater() {
  const frame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  return (find: () => HTMLElement | null | undefined) => {
    cancelAnimationFrame(frame.current);
    // About 1.5 s at most: far longer than a sheet takes to close.
    let frames = 90;
    const step = () => {
      if (document.querySelector('.nx-sheet') && frames-- > 0) {
        frame.current = requestAnimationFrame(step);
        return;
      }
      find()?.focus();
    };
    frame.current = requestAnimationFrame(step);
  };
}

/** The heading of the card on screen (or "All caught up") inside `root`, never one leaving. */
export const cardHeading = (root: HTMLElement | null) =>
  [...(root?.querySelectorAll<HTMLElement>('[data-card-heading]') ?? [])].find(
    (h) => !h.closest('[inert]'),
  );

/**
 * Focuses `heading` and scrolls just enough that everything from the top of `stack` (the Undo line
 * over the card, else the card's top) down to the heading shows. `stack`'s scroll margins say how
 * much of the screen is covered: the preview's bar and the sticky header above, the pinned buttons
 * and the tab bar below. The heading's own focus scroll can't do it: it knows nothing of the line
 * above the card, which is the only way back from a decision and would be left off the top.
 */
export function showCard(
  stack: HTMLElement | null,
  heading: HTMLElement | undefined,
) {
  if (!heading) return;
  heading.focus({ preventScroll: true });
  if (!stack) return;
  const margin = getComputedStyle(stack);
  const above =
    stack.getBoundingClientRect().top - parseFloat(margin.scrollMarginTop);
  const below =
    heading.getBoundingClientRect().bottom +
    parseFloat(margin.scrollMarginBottom) -
    window.innerHeight;
  const by = above < 0 ? above : below > 0 ? Math.min(below, above) : 0;
  if (by) window.scrollBy(0, by);
}

/* ── Small pieces ──────────────────────────────────────────────────────── */

/** Something a person wrote (a note, a reason, a dispute), as a speech bubble under their avatar. */
export function Quote({
  person,
  children,
  className,
}: {
  person: Person;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <Avatar person={person} size="sm" decorative />
      {/* Written text keeps its line breaks, and a pasted link wraps instead of running off. */}
      <p className="min-w-0 flex-1 rounded-nx rounded-tl-md bg-nx-sunken px-4 py-2.5 text-nx-body whitespace-pre-line [overflow-wrap:anywhere] text-nx-ink">
        <span className="sr-only">{person.name}: </span>
        {children}
      </p>
    </div>
  );
}

const SHOT_SIZE = {
  sm: 'h-[78px] w-12 rounded-[11px]',
  md: 'h-[124px] w-[76px] rounded-[14px]',
  // The evidence on Review's card: the card's full width on phones (its top, where the totals
  // are), a tall tile beside the answer on wider screens.
  lg: 'h-[clamp(260px,80vw,340px)] w-full rounded-nx sm:h-[400px] sm:w-[236px]',
} as const;

/**
 * A screenshot as a tile that opens it full screen (arrows move between several). It loads lazily
 * unless `eager` (the first card's, the biggest thing on the screen as Review opens).
 */
export function Shot({
  proofs,
  size = 'md',
  eager,
  className,
}: {
  proofs: Proof[];
  size?: keyof typeof SHOT_SIZE;
  eager?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const first = proofs[0];
  if (!first) return null;
  return (
    <>
      <button
        type="button"
        className={cn(
          'relative shrink-0 overflow-hidden border border-nx-line-strong bg-nx-sunken p-0 transition-[transform,box-shadow] duration-150 ease-nx hover:shadow-nx-lift active:scale-[0.96]',
          SHOT_SIZE[size],
          className,
        )}
        aria-label={`Open the screenshot full screen: ${first.alt}`}
        onClick={() => setOpen(0)}
      >
        <img
          src={first.src}
          alt=""
          decoding="async"
          loading={eager ? 'eager' : 'lazy'}
          draggable={false}
          className="size-full object-cover object-top"
        />
        <span
          className={cn(
            'absolute grid place-items-center rounded-full bg-[var(--nx-bar)] text-[var(--nx-bar-ink)]',
            size === 'sm'
              ? 'right-1 bottom-1 size-6'
              : 'right-1.5 bottom-1.5 size-[30px]',
          )}
          aria-hidden="true"
        >
          <Expand size={size === 'sm' ? 13 : 16} strokeWidth={2.4} />
        </span>
        {proofs.length > 1 && (
          <span
            className="absolute top-1.5 left-1.5 rounded-full bg-[var(--nx-bar)] px-2 py-0.5 text-nx-min font-semibold text-[var(--nx-bar-ink)]"
            aria-hidden="true"
          >
            +{proofs.length - 1}
          </span>
        )}
      </button>
      <ProofViewer
        proofs={proofs}
        index={open}
        onIndex={setOpen}
        onClose={() => setOpen(null)}
      />
    </>
  );
}

type Size = 'md' | 'lg';
const titleClass = (size: Size) =>
  cn('mt-1 font-nx-serif', size === 'lg' ? 'text-nx-h2' : 'text-nx-h3');

/**
 * An item's rule as its heading: the page's card is under the page title (h2), a sheet's body under
 * the sheet's (h3). The card's heading takes focus after each decision, so it's focusable by script
 * (`showCard` scrolls it into view with the card's top and any Undo line above it).
 */
function Title({ size, children }: { size: Size; children: ReactNode }) {
  if (size === 'lg')
    return (
      <h2 tabIndex={-1} data-card-heading className={titleClass(size)}>
        {children}
      </h2>
    );
  return <h3 className={titleClass(size)}>{children}</h3>;
}

/** The answer itself: "11,240 steps", "Yes", "Not logged". */
function Value({
  rule,
  shown,
  size,
}: {
  rule: Rule;
  shown: Shown;
  size: Size;
}) {
  const big = size === 'lg' ? 'text-nx-num-lg' : 'text-nx-num';
  if (shown.done === null)
    return <p className="font-nx-serif text-nx-h2">Not logged</p>;
  if (rule.kind === 'number' && shown.value !== undefined)
    return (
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={cn('font-nx-serif leading-none tabular-nums', big)}>
          {formatNumber(shown.value)}
        </span>
        {rule.target && (
          <span className="text-nx-body text-nx-ink-2">{rule.target.unit}</span>
        )}
      </p>
    );
  return (
    <p className={cn('font-nx-serif leading-none', big)}>
      {shown.done ? 'Yes' : 'No'}
    </p>
  );
}

/**
 * The target beside the partner's number. A number that meets it is only what they say, so the
 * line stays neutral and the reviewer judges it against the screenshot; one that misses is their
 * own admission, so it says so. A rule whose name already says the target ("10,000 steps") or the
 * days ("Gym, 4 days a week") doesn't get them again under it.
 */
function TargetLine({ rule, shown }: { rule: Rule; shown: Shown }) {
  if (rule.kind === 'weekly') {
    const when = whenUnlessTitled(rule);
    return when ? <p className="text-nx-2 text-nx-ink-2">{when}</p> : null;
  }
  if (!rule.target || shown.value === undefined) return null;
  const titled = titleSays(rule.title, rule.target?.value);
  if (meetsTarget(rule.target, shown.value))
    return titled ? null : (
      <p className="text-nx-2 text-nx-ink-2">
        Target: {formatTarget(rule.target)}
      </p>
    );
  return (
    <p className="flex items-start gap-1.5 text-nx-2 font-semibold text-nx-missed">
      <X
        size={18}
        strokeWidth={2.6}
        className="mt-0.5 shrink-0"
        aria-hidden="true"
      />
      <span>
        {titled
          ? 'Misses the target'
          : `Misses the target: ${formatTarget(rule.target)}`}
      </span>
    </p>
  );
}

/* ── What each kind of item shows ──────────────────────────────────────── */

type BodyProps = {
  /** The world the item was drawn from; a leaving card keeps showing it. */
  world: World;
  size?: Size;
  /** Leave the rule's name out (a sheet already shows it as its title). */
  hideTitle?: boolean;
  /** Show whose answer it is and its day above the title. */
  showDay?: boolean;
  /** Load the screenshot straight away (the first card's); others load lazily. */
  eager?: boolean;
};

/** The partner's answer (or late answer): the rule, the answer, whether it meets the target, the note and the screenshot. */
export function AnswerBody({
  world,
  item,
  size = 'md',
  hideTitle,
  showDay,
  eager,
}: BodyProps & { item: AnswerItem | LateItem }) {
  const { rule, entry } = item;
  const shown = shownAnswer(item);
  const late = item.kind === 'correction';
  const kicker = late
    ? `Late answer · ${formatDayShort(entry.day)}`
    : showDay
      ? `${world.partner.name}’s answer · ${formatDayShort(entry.day)}`
      : null;
  const answer = (
    <>
      <Value rule={rule} shown={shown} size={size} />
      <TargetLine rule={rule} shown={shown} />
      {late && (
        <p className="text-nx-2 text-nx-ink-2">
          Before: {formatAnswer(rule, entry)}
        </p>
      )}
    </>
  );
  const note = shown.note ? (
    <Quote person={world.partner}>{shown.note}</Quote>
  ) : null;
  // On the page's card the screenshot is the biggest thing: under the answer and the note on
  // phones (the note first, so the pinned Approve and Dispute never cover it before a scroll), a
  // tall tile on the left with the answer and note beside it on wider screens.
  const beside = size === 'lg' && shown.proofs.length > 0;
  return (
    <div className="flex flex-col gap-4">
      {(kicker || !hideTitle) && (
        <div>
          {kicker && <p className="nx-kicker">{kicker}</p>}
          {!hideTitle && <Title size={size}>{rule.title}</Title>}
        </div>
      )}
      {size === 'lg' ? (
        <div
          className={cn(
            'grid gap-4',
            beside &&
              'sm:grid-cols-[auto_minmax(0,1fr)] sm:grid-rows-[auto_1fr] sm:gap-x-6',
          )}
        >
          <div
            className={cn(
              'flex min-w-0 flex-col gap-2',
              beside && 'sm:col-start-2 sm:row-start-1 sm:pt-1',
            )}
          >
            {answer}
          </div>
          {note && (
            <div
              className={cn(
                beside && 'sm:col-start-2 sm:row-start-2 sm:self-start',
              )}
            >
              {note}
            </div>
          )}
          <Shot
            proofs={shown.proofs}
            size="lg"
            eager={eager}
            className="sm:col-start-1 sm:row-span-2 sm:row-start-1"
          />
        </div>
      ) : (
        <>
          <div className="flex items-end gap-4">
            <Shot proofs={shown.proofs} size="md" />
            <div className="flex min-w-0 flex-col gap-2 pb-0.5">{answer}</div>
          </div>
          {note}
        </>
      )}
    </div>
  );
}

/** The partner asks to forgive one of their points: what was missed, why, and what forgiving does to the viewer's gift. */
export function ForgivenessBody({
  world,
  item,
  size = 'md',
  hideTitle,
}: BodyProps & { item: ForgiveItem }) {
  const effect = forgiveEffect(world, item);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="nx-kicker">{world.partner.name} asks you to forgive</p>
        {!hideTitle && <Title size={size}>{item.rule.title}</Title>}
        <p className="mt-1 text-nx-2 text-nx-ink-2">
          {formatDay(item.point.day)} ·{' '}
          {missWhy(world, item.point, item.rule, item.entry)}
        </p>
      </div>
      <Quote person={world.partner}>{item.request.reason}</Quote>
      <GiftsLink>
        If you forgive it, the gift you get goes from{' '}
        <b className="font-semibold text-nx-ink">{formatMoney(effect.now)}</b>{' '}
        to{' '}
        <b className="font-semibold text-nx-ink">{formatMoney(effect.after)}</b>
        .
      </GiftsLink>
    </div>
  );
}

/** What a decision does to a gift, as a line that opens Gifts (every number leads somewhere). */
function GiftsLink({ children }: { children: ReactNode }) {
  const { navigate } = useNav();
  return (
    <button
      type="button"
      className="nx-press -mx-2 -my-1 flex min-h-11 items-center gap-2 rounded-nx-sm px-2 py-1.5 text-left text-nx-2 text-nx-ink-2 hover:bg-nx-accent-soft"
      onClick={() => navigate('gifts')}
    >
      <span className="min-w-0 flex-1">
        {children}
        <span className="sr-only"> Opens Gifts.</span>
      </span>
      <ChevronRight
        size={18}
        className="shrink-0 text-nx-accent"
        aria-hidden="true"
      />
    </button>
  );
}

/** The partner disputes one of the viewer's answers: the answer, the comment, any reply, and what conceding costs. */
export function DisputeBody({
  world,
  item,
  size = 'md',
  hideTitle,
}: BodyProps & { item: DisputeItem }) {
  const { rule, entry, dispute } = item;
  const effect = concedeEffect(world, item);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="nx-kicker">{world.partner.name} disputes your answer</p>
        {!hideTitle && <Title size={size}>{rule.title}</Title>}
        <p className="mt-1 text-nx-2 text-nx-ink-2">
          {formatDay(entry.day)} · You answered {formatAnswer(rule, entry)}
        </p>
      </div>
      <Quote person={world.partner}>{dispute.comment}</Quote>
      {dispute.reply && <Quote person={world.me}>{dispute.reply}</Quote>}
      {/* The kicker names the partner, so the gift line says only which gift. */}
      <GiftsLink>
        If you concede, it becomes a point and the gift you give goes from{' '}
        <b className="font-semibold text-nx-ink">{formatMoney(effect.now)}</b>{' '}
        to{' '}
        <b className="font-semibold text-nx-ink">{formatMoney(effect.after)}</b>
        .
      </GiftsLink>
    </div>
  );
}

/** Whichever body fits the item. */
export function ItemBody(props: BodyProps & { item: ReviewItem }) {
  const { item } = props;
  if (item.kind === 'forgiveness')
    return <ForgivenessBody {...props} item={item} />;
  if (item.kind === 'dispute') return <DisputeBody {...props} item={item} />;
  return <AnswerBody {...props} item={item} />;
}

/** One line about an answer, for the top of a sheet: "10,000 steps · Thursday, Nov 19 · 11,240 steps". */
export function AnswerSummary({ item }: { item: AnswerItem | LateItem }) {
  return (
    <div className="rounded-nx bg-nx-sunken px-4 py-3">
      <p className="text-nx-body font-semibold">{item.rule.title}</p>
      <p className="text-nx-2 text-nx-ink-2">
        {formatDay(item.entry.day)} ·{' '}
        {formatAnswer(item.rule, shownAnswer(item))}
      </p>
    </div>
  );
}

/**
 * The decision just made, with Undo while it waits to be sent: on the page where it was made, never
 * a pop-up. A screen reader hears the decision. Its clock stands still while a pointer or finger is
 * on Undo or focus is (`onPause`, the review's `pause`).
 */
export function UndoLine({
  held,
  onUndo,
  onPause,
  ref,
  className,
}: {
  held: Held;
  onUndo: () => void;
  onPause: (why: Pause, on: boolean) => void;
  ref?: Ref<HTMLDivElement>;
  className?: string;
}) {
  const s = STAMP[held.outcome];
  const Icon = s.icon;
  // Gone with a pointer or focus still on Undo (a sheet closing under it): its clock runs on.
  useEffect(
    () => () => {
      onPause('pointer', false);
      onPause('focus', false);
    },
    [onPause],
  );
  return (
    <div
      ref={ref}
      tabIndex={-1}
      className={cn(
        'nx-enter flex min-h-12 items-center gap-3 rounded-nx py-1 pr-1 pl-4',
        s.tint,
        className,
      )}
    >
      <Icon
        size={20}
        strokeWidth={2.4}
        className={cn('shrink-0', s.ink)}
        aria-hidden="true"
      />
      <output className="min-w-0 flex-1 text-nx-body text-nx-ink">
        <span className={cn('font-semibold', s.ink)}>{s.label}</span> ·{' '}
        {held.about}
      </output>
      <Button
        variant="quiet"
        onClick={onUndo}
        // A pointer is on it from before a press until after it lifts, a finger's too.
        onPointerEnter={() => onPause('pointer', true)}
        onPointerLeave={() => onPause('pointer', false)}
        onFocus={() => onPause('focus', true)}
        onBlur={() => onPause('focus', false)}
      >
        Undo
      </Button>
    </div>
  );
}

/* ── Sheets ────────────────────────────────────────────────────────────── */

/**
 * "Approve both for Thursday": every answer of that day, each with its rule, the answer and its
 * screenshot (which opens full screen), so nothing is approved unseen. The main button approves
 * them together.
 */
export function ApproveDaySheet({
  sheet,
  partner,
  onApprove,
}: {
  sheet: SheetFor<DayGroup>;
  partner: Person;
  onApprove: (group: DayGroup) => void;
}) {
  const group = sheet.target;
  return (
    <Sheet
      open={sheet.open}
      onOpenChange={sheet.setOpen}
      title={
        group
          ? `${partner.name}’s answers for ${formatWeekday(group.day)}`
          : `${partner.name}’s answers`
      }
      footer={
        <>
          <Button onClick={() => sheet.setOpen(false)}>Cancel</Button>
          <Button
            variant="primary"
            icon={CheckCheck}
            onClick={() => group && onApprove(group)}
          >
            {approveAllLabel(group?.items.length ?? 2)}
          </Button>
        </>
      }
    >
      {group && (
        <ul className="flex flex-col gap-2.5">
          {group.items.map((item) => {
            const shown = shownAnswer(item);
            return (
              <li
                key={item.id}
                className="flex items-center gap-4 rounded-nx bg-nx-sunken py-3 pr-3 pl-4"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="text-nx-body font-semibold">
                    {item.rule.title}
                  </p>
                  <p className="font-nx-serif text-nx-h3 leading-tight tabular-nums">
                    {formatAnswer(item.rule, shown)}
                  </p>
                  <TargetLine rule={item.rule} shown={shown} />
                  {shown.note && (
                    <p className="line-clamp-2 text-nx-2 text-nx-ink-2">
                      <span className="sr-only">{partner.name}’s note: </span>“
                      {shown.note}”
                    </p>
                  )}
                </div>
                <Shot proofs={shown.proofs} size="sm" />
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}

/** Dispute one of the partner's answers: a reason is required. `onDone` runs once it's sent. */
export function DisputeSheet({
  sheet,
  review,
  onDone,
}: {
  sheet: SheetFor<AnswerItem>;
  review: Review;
  onDone?: () => void;
}) {
  const partner = review.world.partner.name;
  return (
    <ReasonSheet
      key={`dispute:${sheet.target?.id}`}
      open={sheet.open}
      onOpenChange={sheet.setOpen}
      title={`Dispute ${partner}’s answer`}
      description={`No point while it’s open. It becomes a point only if ${partner} concedes; if it’s still open when the challenge ends, it isn’t one. You can withdraw it any time.`}
      label="Your reason"
      hint={`${partner} reads exactly what you write.`}
      placeholder="What looks off to you?"
      submit="Dispute"
      missing={`Write a reason so ${partner} knows what to look at.`}
      onSubmit={(reason) => {
        if (sheet.target) review.dispute(sheet.target, reason);
        sheet.setOpen(false);
        onDone?.();
      }}
    >
      {sheet.target && <AnswerSummary item={sheet.target} />}
    </ReasonSheet>
  );
}

/** Reply to a dispute on the viewer's answer; it stays open, and the partner reads the reply. */
export function ReplySheet({
  sheet,
  review,
  onDone,
}: {
  sheet: SheetFor<DisputeItem>;
  review: Review;
  onDone?: () => void;
}) {
  const partner = review.world.partner;
  return (
    <ReasonSheet
      key={`reply:${sheet.target?.id}`}
      open={sheet.open}
      onOpenChange={sheet.setOpen}
      title={`Reply to ${partner.name}`}
      description={`No point while it’s open. ${partner.name} can withdraw it, and you can still concede later.`}
      // The title says who reads it, so the field has no hint saying so again.
      label="Your reply"
      submit="Send reply"
      missing="Write your reply first."
      onSubmit={(text) => {
        if (sheet.target) review.reply(sheet.target, text);
        sheet.setOpen(false);
        onDone?.();
      }}
    >
      {sheet.target && (
        <Quote person={partner}>{sheet.target.dispute.comment}</Quote>
      )}
    </ReasonSheet>
  );
}

/* ── Waiting on the partner ────────────────────────────────────────────── */

/**
 * One quiet row, "Waiting for Jordan · 1 answer", that opens what the partner still has to do for
 * the viewer: their answers waiting for review, forgiveness they asked for, disputes they raised
 * (which they can withdraw) and disputes they replied to (which they can still concede).
 */
export function WaitingForPartner({
  review,
  className,
}: {
  review: Review;
  className?: string;
}) {
  const { world, state, held } = review;
  const [open, setOpen] = useState(false);
  const partner = world.partner;
  const { theirs, replied } = state;
  // Conceding here shows its Undo line here (the sheet stays open); focus goes to it, and back to
  // that Concede button after Undo. The sheet moves focus to itself on the next frame when the
  // focused button goes, so this waits one frame more.
  const line = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const focusSoon = (find: () => HTMLElement | null | undefined) =>
    requestAnimationFrame(() => requestAnimationFrame(() => find()?.focus()));
  const concede = (item: DisputeItem) => {
    review.concede(item, 'waiting');
    focusSoon(() => line.current);
  };
  const undo = () => {
    const id = held?.ids[0];
    review.undo();
    focusSoon(() =>
      list.current?.querySelector<HTMLElement>(`[data-concede="${id}"]`),
    );
  };
  const answer = (rule: Rule, text: string) => (
    <>
      <p className="text-nx-body font-semibold">{rule.title}</p>
      <p className="text-nx-2 text-nx-ink-2">{text}</p>
    </>
  );
  return (
    <>
      {state.waiting > 0 && (
        <div className={className}>
          <RowButton
            glass={false}
            leading={<Avatar person={partner} decorative />}
            title={`Waiting for ${partner.name}`}
            detail={waitingSummary(state)}
            onClick={() => setOpen(true)}
          />
        </div>
      )}
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={`Waiting for ${partner.name}`}
        description={
          state.waiting ? undefined : `Nothing waits for ${partner.name}.`
        }
        footer={
          <Button variant="primary" onClick={() => setOpen(false)}>
            Done
          </Button>
        }
      >
        {held?.from === 'waiting' && (
          <UndoLine
            ref={line}
            held={held}
            onUndo={undo}
            onPause={review.pause}
            className={state.waiting > 0 ? 'mb-3' : undefined}
          />
        )}
        {/* Everything here waits for the partner, as the title says, so no item has a pill saying it. */}
        {state.waiting > 0 && (
          <ul ref={list} className="flex flex-col gap-3">
            {[...theirs.answers, ...theirs.corrections].map((i) => (
              <Card as="li" pad="sm" key={i.id}>
                {answer(
                  i.rule,
                  `${formatDay(i.entry.day)} · ${
                    i.kind === 'correction' ? 'Late answer:' : 'You answered'
                  } ${formatAnswer(i.rule, shownAnswer(i))}`,
                )}
              </Card>
            ))}
            {theirs.forgiveness.map((i) => (
              <Card as="li" pad="sm" key={i.id} className="flex flex-col gap-3">
                <div>
                  {answer(
                    i.rule,
                    `${formatDay(i.point.day)} · You asked to forgive it`,
                  )}
                </div>
                <Quote person={world.me}>{i.request.reason}</Quote>
              </Card>
            ))}
            {theirs.disputes.map((i) => (
              <Card as="li" pad="sm" key={i.id} className="flex flex-col gap-3">
                <div>
                  {answer(
                    i.rule,
                    `${formatDay(i.entry.day)} · You disputed ${partner.name}’s ${formatAnswer(i.rule, i.entry)}`,
                  )}
                </div>
                <Quote person={world.me}>{i.dispute.comment}</Quote>
                <Button
                  icon={Undo2}
                  className="self-start"
                  onClick={() => review.withdraw(i.dispute.id)}
                >
                  Withdraw dispute
                </Button>
              </Card>
            ))}
            {replied.map((i) => (
              <Card as="li" pad="sm" key={i.id} className="flex flex-col gap-3">
                <DisputeBody world={world} item={i} />
                <Button
                  data-concede={i.id}
                  className="self-start"
                  onClick={() => concede(i)}
                >
                  Concede
                </Button>
              </Card>
            ))}
          </ul>
        )}
      </Sheet>
    </>
  );
}

/* ── All caught up ─────────────────────────────────────────────────────── */

/** Nothing waits: a check that pops in, and the next useful thing to do (logging the open day, or Overview). */
export function CaughtUp({ world }: { world: World }) {
  const { navigate } = useNav();
  const still = useReducedMotion();
  const day = openDay(world);
  const left = day ? openCheckins(world, world.me.id, day).length : 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: still ? 0 : DURATION.slow, ease: EASE }}
    >
      <GlassCard
        pad="lg"
        className="flex flex-col items-center gap-3 py-10 text-center"
      >
        <motion.span
          className="mb-1 grid size-16 place-items-center rounded-full bg-nx-done-soft text-nx-done"
          initial={{ scale: 0.6 }}
          animate={{ scale: [0.6, 1.08, 1] }}
          transition={{
            duration: still ? 0 : DURATION.slow,
            times: [0, 0.7, 1],
            ease: EASE,
          }}
        >
          <CheckCheck size={30} strokeWidth={2.2} aria-hidden="true" />
        </motion.span>
        {/* Focused after the last decision; `showCard` brings the card's top, its check included, into view. */}
        <h2
          tabIndex={-1}
          data-card-heading
          className="font-nx-serif text-nx-h2"
        >
          All caught up
        </h2>
        <p className="max-w-sm text-nx-body text-nx-ink-2">
          {world.partner.name}’s next answers show up here.
        </p>
        <div className="mt-3">
          {day && left > 0 ? (
            <Button variant="primary" onClick={() => navigate('log')}>
              Log {formatWeekday(day)}
            </Button>
          ) : (
            <Button variant="primary" onClick={() => navigate('overview')}>
              Go to Overview
            </Button>
          )}
        </div>
      </GlassCard>
    </motion.div>
  );
}
