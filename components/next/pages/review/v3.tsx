// Version 3: a short checklist; approve answers right in the list or all at once from the bar at the bottom, and open anything for its details.
'use client';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import {
  Check,
  CheckCheck,
  ChevronRight,
  HeartHandshake,
  TriangleAlert,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { World } from '@/lib/next/model';
import {
  formatAnswer,
  formatDay,
  formatWeekday,
  meetsTarget,
} from '@/lib/next/selectors';
import { AppFrame } from '@/components/next/frames';
import {
  ActionBar,
  Avatar,
  Button,
  Enter,
  PageTitle,
  Sheet,
  TextField,
} from '@/components/next/ui';
import { cn } from '@/lib/utils';
import { ClearItem, ClearList, OutcomeContext } from './motion';
import {
  AnswerSummary,
  CaughtUp,
  DayHeader,
  ItemBody,
  Shot,
  WaitingForPartner,
  useRefocus,
  useSheetFor,
  type SheetFor,
} from './parts';
import {
  ACTIONS,
  approveAllLabel,
  shortTitle,
  shownAnswer,
  type AnswerItem,
  type LateItem,
  type ReviewItem,
} from './queue';
import { useReview, type Review } from './use-review';

/** What an open sheet shows: the item and the world it was opened on, so it stays put while closing. */
type Opened = { item: ReviewItem; world: World };

/** Review, version 3. */
export default function ReviewV3() {
  const review = useReview();
  const { world, state } = review;
  const partner = world.partner.name;
  const sheet = useSheetFor<Opened>();
  const open = (item: ReviewItem) => sheet.show({ item, world });
  const list = useRef<HTMLDivElement>(null);
  useRefocus(list, state.todo.length);

  const blocks: ReactElement[] = [];
  for (const group of state.days) {
    blocks.push(
      <ClearItem key={`day:${group.day}`} id={`day:${group.day}`} space="sm">
        <DayHeader world={world} day={group.day} />
      </ClearItem>,
    );
    group.items.forEach((item, i) =>
      blocks.push(
        <ClearItem
          key={item.id}
          id={item.id}
          space={i === group.items.length - 1 ? 'lg' : 'sm'}
        >
          <AnswerRow
            item={item}
            onOpen={() => open(item)}
            onApprove={() => review.approve(item)}
          />
        </ClearItem>,
      ),
    );
  }
  for (const item of state.late)
    blocks.push(
      <ClearItem key={item.id} id={item.id} space="lg">
        <AnswerRow
          item={item}
          onOpen={() => open(item)}
          onApprove={() => review.approve(item)}
        />
      </ClearItem>,
    );
  const asks = [...state.forgiveness, ...state.disputes];
  if (asks.length)
    blocks.push(
      <ClearItem key="asks" id="asks" space="sm">
        <h2 className="nx-section-title pt-1">To decide</h2>
      </ClearItem>,
    );
  for (const item of asks)
    blocks.push(
      <ClearItem key={item.id} id={item.id} space="sm">
        <AskRow item={item} world={world} onOpen={() => open(item)} />
      </ClearItem>,
    );

  // The bar's one filled button: approve the first day's answers, or open what comes next.
  const first = state.days[0];
  const head = state.todo[0];
  const primary: { label: string; icon?: LucideIcon; run: () => void } | null =
    first
      ? first.items.length > 1
        ? {
            label:
              approveAllLabel(first.items.length) +
              (state.days.length > 1 ? ` for ${formatWeekday(first.day)}` : ''),
            icon: CheckCheck,
            run: () => review.approveAll(first.items),
          }
        : {
            label: `Approve ${shortTitle(first.items[0].rule)}`,
            icon: Check,
            run: () => review.approve(first.items[0]),
          }
      : head
        ? {
            label:
              head.kind === 'forgiveness'
                ? `Open ${partner}’s request`
                : head.kind === 'dispute'
                  ? 'Open the dispute'
                  : 'Open the late answer',
            run: () => open(head),
          }
        : null;

  return (
    <AppFrame>
      <OutcomeContext.Provider value={review.outcomes}>
        <div className="flex flex-col gap-5">
          <PageTitle title="Review" />
          <div ref={list}>
            <Enter index={1}>
              <ClearList>{blocks}</ClearList>
              {state.todo.length === 0 && <CaughtUp world={world} />}
            </Enter>
          </div>
          <Enter index={2}>
            <WaitingForPartner review={review} />
          </Enter>
          {primary && (
            <ActionBar>
              <Button
                variant="primary"
                size="lg"
                full
                icon={primary.icon}
                className="whitespace-normal"
                onClick={primary.run}
              >
                {primary.label}
              </Button>
            </ActionBar>
          )}
        </div>
      </OutcomeContext.Provider>
      <ItemSheet key={sheet.target?.item.id} sheet={sheet} review={review} />
    </AppFrame>
  );
}

/** One of the partner's answers as a row: the screenshot, the answer and whether it meets the target, and Approve. */
function AnswerRow({
  item,
  onOpen,
  onApprove,
}: {
  item: AnswerItem | LateItem;
  onOpen: () => void;
  onApprove: () => void;
}) {
  const shown = shownAnswer(item);
  const { rule } = item;
  const met =
    rule.kind === 'number' && rule.target && shown.value !== undefined
      ? meetsTarget(rule.target, shown.value)
      : null;
  const Icon = met === null ? null : met ? Check : X;
  return (
    <div className="nx-glass flex items-center gap-3 p-3">
      {shown.proofs.length ? (
        <Shot proofs={shown.proofs} size="sm" />
      ) : (
        <span
          className="grid h-[78px] w-12 shrink-0 place-items-center rounded-[11px] bg-nx-sunken font-nx-serif text-nx-h3"
          aria-hidden="true"
        >
          {shown.done === null ? '–' : shown.done ? 'Yes' : 'No'}
        </span>
      )}
      <button
        type="button"
        className="nx-press flex min-h-11 min-w-0 flex-1 flex-col items-start gap-0.5 self-stretch rounded-nx-sm px-1 text-left"
        onClick={onOpen}
      >
        {item.kind === 'correction' && (
          <span className="text-nx-min font-semibold text-nx-accent">
            Late answer · {formatDay(item.entry.day)}
          </span>
        )}
        <span className="text-nx-body leading-snug font-semibold">
          {shortTitle(rule)}
        </span>
        <span
          className={cn(
            'flex items-center gap-1 text-nx-2 font-semibold',
            met === null
              ? 'text-nx-ink-2'
              : met
                ? 'text-nx-done'
                : 'text-nx-missed',
          )}
        >
          {Icon && <Icon size={16} strokeWidth={2.6} aria-hidden="true" />}
          {formatAnswer(rule, shown)}
          {met !== null && (
            <span className="sr-only">
              {met ? ', meets the target' : ', misses the target'}
            </span>
          )}
        </span>
        <span className="text-nx-2 text-nx-accent">Details</span>
      </button>
      <Button className="shrink-0 px-4" onClick={onApprove}>
        Approve
      </Button>
    </div>
  );
}

/** A forgiveness request or a dispute as a row: who asks what, and the start of their words. */
function AskRow({
  item,
  world,
  onOpen,
}: {
  item: ReviewItem;
  world: World;
  onOpen: () => void;
}) {
  const forgive = item.kind === 'forgiveness';
  const Icon = forgive ? HeartHandshake : TriangleAlert;
  const words =
    item.kind === 'forgiveness'
      ? item.request.reason
      : item.kind === 'dispute'
        ? item.dispute.comment
        : '';
  return (
    <button
      type="button"
      className="nx-glass nx-tappable nx-row items-start"
      onClick={onOpen}
    >
      <span className="relative mt-0.5 shrink-0">
        <Avatar person={world.partner} decorative />
        <span className="absolute -right-1.5 -bottom-1.5 grid size-6 place-items-center rounded-full bg-nx-surface text-nx-accent shadow-nx-glass">
          <Icon size={14} strokeWidth={2.4} aria-hidden="true" />
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="nx-kicker">
          {forgive
            ? `${world.partner.name} asks you to forgive`
            : `${world.partner.name} disputes your answer`}
        </span>
        <span className="text-nx-body font-semibold">{item.rule.title}</span>
        <span className="line-clamp-2 text-nx-2 text-nx-ink-2">{words}</span>
      </span>
      <ChevronRight
        className="nx-row-chevron self-center"
        size={22}
        aria-hidden="true"
      />
    </button>
  );
}

/**
 * Everything about one item, with its two buttons. Dispute and Keep it open turn the sheet into a
 * short form (a reason or a reply) instead of stacking another sheet.
 */
function ItemSheet({
  sheet,
  review,
}: {
  sheet: SheetFor<Opened>;
  review: Review;
}) {
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState(false);
  const field = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (writing) field.current?.querySelector('textarea')?.focus();
  }, [writing]);

  const opened = sheet.target;
  if (!opened) return null;
  const { item, world } = opened;
  const partner = world.partner.name;
  const close = () => sheet.setOpen(false);
  const done = (act: () => void) => {
    act();
    close();
  };
  const send = () => {
    const words = text.trim();
    if (!words) return setError(true);
    if (item.kind === 'answer') done(() => review.dispute(item, words));
    if (item.kind === 'dispute') done(() => review.reply(item, words));
  };

  const title =
    writing && item.kind === 'answer'
      ? `Dispute ${partner}’s answer`
      : writing
        ? 'Keep it open'
        : item.rule.title;
  const description =
    item.kind === 'answer' && !writing
      ? `${partner}’s answer · ${formatDay(item.entry.day)}`
      : undefined;

  let footer: ReactElement;
  if (writing)
    footer = (
      <>
        <Button onClick={() => setWriting(false)}>Back</Button>
        <Button variant="primary" onClick={send}>
          {item.kind === 'answer' ? 'Dispute' : 'Send reply'}
        </Button>
      </>
    );
  else {
    const { main, alt } = ACTIONS[item.kind];
    const [onMain, onAlt] =
      item.kind === 'answer'
        ? [() => done(() => review.approve(item)), () => setWriting(true)]
        : item.kind === 'correction'
          ? [
              () => done(() => review.approve(item)),
              () => done(() => review.declineLate(item)),
            ]
          : item.kind === 'forgiveness'
            ? [
                () => done(() => review.forgive(item)),
                () => done(() => review.decline(item)),
              ]
            : [() => done(() => review.concede(item)), () => setWriting(true)];
    footer = (
      <>
        <Button onClick={onAlt}>{alt}</Button>
        <Button
          variant="primary"
          icon={
            item.kind === 'answer' || item.kind === 'correction'
              ? Check
              : undefined
          }
          onClick={onMain}
        >
          {main}
        </Button>
      </>
    );
  }

  return (
    <Sheet
      open={sheet.open}
      onOpenChange={(next) => {
        sheet.setOpen(next);
        if (!next) setError(false);
      }}
      title={title}
      description={description}
      footer={footer}
    >
      {writing ? (
        <div ref={field} className="flex flex-col gap-4">
          {item.kind === 'dispute' && (
            <ItemBody world={world} item={item} hideTitle />
          )}
          {item.kind === 'answer' && <AnswerSummary item={item} />}
          <TextField
            label={
              item.kind === 'answer'
                ? 'Your reason'
                : `Your reply to ${partner}`
            }
            hint={
              item.kind === 'answer'
                ? `It becomes a point only if ${partner} concedes.`
                : `No point while it’s open. ${partner} can withdraw it, and you can still concede later.`
            }
            multiline
            rows={3}
            value={text}
            onChange={(v) => {
              setText(v);
              if (v.trim()) setError(false);
            }}
            error={
              error
                ? item.kind === 'answer'
                  ? 'Write your reason first.'
                  : 'Write your reply first.'
                : undefined
            }
          />
        </div>
      ) : (
        <ItemBody world={world} item={item} hideTitle />
      )}
    </Sheet>
  );
}
