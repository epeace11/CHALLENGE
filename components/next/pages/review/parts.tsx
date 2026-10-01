'use client';
import { useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Check,
  CheckCheck,
  ChevronRight,
  Expand,
  Undo2,
  X,
} from 'lucide-react';
import type { Person, Proof, Rule, World } from '@/lib/next/model';
import {
  formatAnswer,
  formatDay,
  formatDayShort,
  formatMoney,
  formatNumber,
  formatTarget,
  formatWeekday,
  formatWhen,
  meetsTarget,
  openCheckins,
  openDay,
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
  Sheet,
  StatusPill,
  TextField,
} from '@/components/next/ui';
import { cn } from '@/lib/utils';
import {
  concedeEffect,
  forgiveEffect,
  missWhy,
  shownAnswer,
  waitingSummary,
  type AnswerItem,
  type DisputeItem,
  type ForgiveItem,
  type LateItem,
  type ReviewItem,
  type Shown,
} from './queue';
import type { Review } from './use-review';

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
      <p className="min-w-0 flex-1 rounded-nx rounded-tl-md bg-nx-sunken px-4 py-2.5 text-nx-body text-nx-ink">
        <span className="sr-only">{person.name}: </span>
        {children}
      </p>
    </div>
  );
}

const SHOT_SIZE = {
  sm: 'h-[78px] w-12 rounded-[11px]',
  md: 'h-[124px] w-[76px] rounded-[14px]',
  lg: 'h-[clamp(170px,49vw,232px)] w-[clamp(104px,30vw,142px)] rounded-nx',
} as const;

/** A screenshot as a tile that opens it full screen (arrows move between several). */
export function Shot({
  proofs,
  size = 'md',
  className,
}: {
  proofs: Proof[];
  size?: keyof typeof SHOT_SIZE;
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

/** Whether a number meets its target, in the done or missed colour. */
function TargetLine({ rule, shown }: { rule: Rule; shown: Shown }) {
  if (rule.kind === 'weekly')
    return <p className="text-nx-2 text-nx-ink-2">{formatWhen(rule)}</p>;
  if (!rule.target || shown.value === undefined) return null;
  const met = meetsTarget(rule.target, shown.value);
  const Icon = met ? Check : X;
  return (
    <p
      className={cn(
        'flex items-start gap-1.5 text-nx-2 font-semibold',
        met ? 'text-nx-done' : 'text-nx-missed',
      )}
    >
      <Icon
        size={18}
        strokeWidth={2.6}
        className="mt-0.5 shrink-0"
        aria-hidden="true"
      />
      <span>
        {met ? 'Meets' : 'Misses'} the target: {formatTarget(rule.target)}
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
};

/** The partner's answer (or late answer): the rule, the answer, whether it meets the target, the screenshot and the note. */
export function AnswerBody({
  world,
  item,
  size = 'md',
  hideTitle,
  showDay,
}: BodyProps & { item: AnswerItem | LateItem }) {
  const { rule, entry } = item;
  const shown = shownAnswer(item);
  const late = item.kind === 'correction';
  const kicker = late
    ? `Late answer · ${formatDayShort(entry.day)}`
    : showDay
      ? `${world.partner.name}’s answer · ${formatDayShort(entry.day)}`
      : null;
  return (
    <div className="flex flex-col gap-4">
      {(kicker || !hideTitle) && (
        <div>
          {kicker && <p className="nx-kicker">{kicker}</p>}
          {!hideTitle && <h3 className={titleClass(size)}>{rule.title}</h3>}
        </div>
      )}
      <div className="flex items-end gap-4">
        <Shot proofs={shown.proofs} size={size === 'lg' ? 'lg' : 'md'} />
        <div className="flex min-w-0 flex-col gap-2 pb-0.5">
          <Value rule={rule} shown={shown} size={size} />
          <TargetLine rule={rule} shown={shown} />
          {late && (
            <p className="text-nx-2 text-nx-ink-2">
              Before: {formatAnswer(rule, entry)}
            </p>
          )}
        </div>
      </div>
      {shown.note && <Quote person={world.partner}>{shown.note}</Quote>}
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
        {!hideTitle && <h3 className={titleClass(size)}>{item.rule.title}</h3>}
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
        {!hideTitle && <h3 className={titleClass(size)}>{rule.title}</h3>}
        <p className="mt-1 text-nx-2 text-nx-ink-2">
          {formatDay(entry.day)} · You answered {formatAnswer(rule, entry)}
        </p>
      </div>
      <Quote person={world.partner}>{dispute.comment}</Quote>
      {dispute.reply && <Quote person={world.me}>{dispute.reply}</Quote>}
      <GiftsLink>
        If you concede, it becomes a point and your gift to {world.partner.name}{' '}
        goes from{' '}
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

/* ── Sheets ────────────────────────────────────────────────────────────── */

/**
 * A sheet that asks for a few words before acting: a reason to dispute, a reply that keeps a
 * dispute open. The field is focused when it opens; sending without words says what is missing.
 * Give it a `key` per item so a draft never carries over to another one.
 */
export function ReasonSheet({
  open,
  onOpenChange,
  title,
  description,
  label,
  submit,
  missing,
  onSubmit,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  label: string;
  submit: string;
  /** What the error says when the field is empty. */
  missing: string;
  onSubmit: (text: string) => void;
  children?: ReactNode;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState(false);
  const field = useRef<HTMLElement | null>(null);
  const send = () => {
    const words = text.trim();
    if (!words) {
      setError(true);
      return;
    }
    onSubmit(words);
    setText('');
    setError(false);
  };
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(false);
        onOpenChange(next);
      }}
      title={title}
      description={description}
      initialFocus={field}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" onClick={send}>
            {submit}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {children}
        <div
          ref={(el) => {
            field.current = el?.querySelector('textarea') ?? null;
          }}
        >
          <TextField
            label={label}
            multiline
            rows={3}
            value={text}
            onChange={(v) => {
              setText(v);
              if (v.trim()) setError(false);
            }}
            error={error ? missing : undefined}
          />
        </div>
      </div>
    </Sheet>
  );
}

/** Dispute one of the partner's answers: a reason is required. */
export function DisputeSheet({
  sheet,
  review,
}: {
  sheet: SheetFor<AnswerItem>;
  review: Review;
}) {
  const partner = review.world.partner.name;
  return (
    <ReasonSheet
      key={`dispute:${sheet.target?.id}`}
      open={sheet.open}
      onOpenChange={sheet.setOpen}
      title={`Dispute ${partner}’s answer`}
      description={`It becomes a point only if ${partner} concedes.`}
      label="Your reason"
      submit="Dispute"
      missing="Write your reason first."
      onSubmit={(reason) => {
        if (sheet.target) review.dispute(sheet.target, reason);
        sheet.setOpen(false);
      }}
    >
      {sheet.target && <AnswerSummary item={sheet.target} />}
    </ReasonSheet>
  );
}

/** Keep a dispute on the viewer's answer open, with a reply the partner reads. */
export function ReplySheet({
  sheet,
  review,
}: {
  sheet: SheetFor<DisputeItem>;
  review: Review;
}) {
  const partner = review.world.partner;
  return (
    <ReasonSheet
      key={`reply:${sheet.target?.id}`}
      open={sheet.open}
      onOpenChange={sheet.setOpen}
      title="Keep it open"
      description={`No point while it’s open. ${partner.name} can withdraw it, and you can still concede later.`}
      label={`Your reply to ${partner.name}`}
      submit="Send reply"
      missing="Write your reply first."
      onSubmit={(text) => {
        if (sheet.target) review.reply(sheet.target, text);
        sheet.setOpen(false);
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
  const { world, state } = review;
  const [open, setOpen] = useState(false);
  const partner = world.partner;
  const { theirs, replied } = state;
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
        {state.waiting > 0 && (
          <ul className="flex flex-col gap-3">
            {[...theirs.answers, ...theirs.corrections].map((i) => (
              <Card as="li" pad="sm" key={i.id} className="flex flex-col gap-2">
                {answer(
                  i.rule,
                  `${formatDay(i.entry.day)} · You answered ${formatAnswer(
                    i.rule,
                    shownAnswer(i),
                  )}`,
                )}
                <StatusPill
                  status="review"
                  label={
                    i.kind === 'correction'
                      ? 'Late answer waiting'
                      : 'Waiting for review'
                  }
                  className="self-start"
                />
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
                <StatusPill
                  status="review"
                  label="Forgiveness asked"
                  className="self-start"
                />
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
                  className="self-start"
                  onClick={() => review.concede(i)}
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
        <h2 className="font-nx-serif text-nx-h2">All caught up</h2>
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
