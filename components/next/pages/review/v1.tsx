// One thing at a time on a big card with a large screenshot; its two buttons stay pinned at the bottom.
'use client';
import { useState } from 'react';
import { Check, CheckCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { AppFrame } from '@/components/next/frames';
import {
  ActionBar,
  Avatar,
  Button,
  Enter,
  GlassCard,
  IconButton,
  PageTitle,
  RowButton,
  Sheet,
  StatusPill,
} from '@/components/next/ui';
import { formatDayShort, formatWeekday } from '@/lib/next/selectors';
import { cn } from '@/lib/utils';
import { Deck, OutcomeContext } from './motion';
import {
  CaughtUp,
  DisputeSheet,
  ItemBody,
  ReplySheet,
  WaitingForPartner,
  useSheetFor,
} from './parts';
import {
  ACTIONS,
  approveAllLabel,
  shortTitle,
  type AnswerItem,
  type DisputeItem,
  type ReviewItem,
} from './queue';
import { useReview } from './use-review';

const KIND: Record<ReviewItem['kind'], string> = {
  answer: 'Answer',
  correction: 'Late answer',
  forgiveness: 'Forgiveness',
  dispute: 'Dispute on your answer',
};

const dayOf = (item: ReviewItem) =>
  item.kind === 'forgiveness' ? item.point.day : item.entry.day;

/** Review, version 2. */
export default function ReviewV2() {
  const review = useReview();
  const { world, state } = review;
  const todo = state.todo;
  const ids = todo.map((i) => i.id);
  const open = new Set(ids);

  // Everything met on this visit, in order, so the steps show what is done and new items join the end.
  const [order, setOrder] = useState<string[]>(ids);
  const fresh = ids.filter((id) => !order.includes(id));
  const known = fresh.length ? [...order, ...fresh] : order;
  if (fresh.length) setOrder(known);

  // The card on screen: the one picked, or once it is decided, the next one still open.
  const [pick, setPick] = useState<string | null>(null);
  const from = pick ? known.indexOf(pick) : -1;
  const currentId =
    (pick && open.has(pick) ? pick : undefined) ??
    known.slice(from + 1).find((id) => open.has(id)) ??
    known.find((id) => open.has(id)) ??
    null;
  const current = todo.find((i) => i.id === currentId) ?? null;
  const index = currentId ? known.indexOf(currentId) : -1;
  const prev = known
    .slice(0, Math.max(0, index))
    .reverse()
    .find((id) => open.has(id));
  const next = known.slice(index + 1).find((id) => open.has(id));

  // Cards glide forward, or back when the new one comes earlier (Previous, or Undo).
  const [shown, setShown] = useState<{ id: string | null; direction: 1 | -1 }>({
    id: currentId,
    direction: 1,
  });
  if (shown.id !== currentId) {
    const back =
      currentId !== null &&
      shown.id !== null &&
      known.indexOf(currentId) < known.indexOf(shown.id);
    setShown({ id: currentId, direction: back ? -1 : 1 });
  }

  const [listOpen, setListOpen] = useState(false);
  const disputing = useSheetFor<AnswerItem>();
  const replying = useSheetFor<DisputeItem>();

  /** Acts on the card on screen, remembering it so the next open one follows. */
  const decide = (item: ReviewItem, main: boolean) => {
    setPick(item.id);
    if (item.kind === 'answer')
      return main ? review.approve(item) : disputing.show(item);
    if (item.kind === 'correction')
      return main ? review.approve(item) : review.declineLate(item);
    if (item.kind === 'forgiveness')
      return main ? review.forgive(item) : review.decline(item);
    return main ? review.concede(item) : replying.show(item);
  };

  // "Approve both" on an answer card while its day has several answers waiting.
  const day =
    current?.kind === 'answer'
      ? state.days.find((g) => g.day === current.entry.day)
      : undefined;
  const approveDay =
    current && day && day.items.length > 1 ? (
      <div className="mt-6 border-t border-nx-line pt-3">
        <Button
          variant="quiet"
          icon={CheckCheck}
          className="-ml-3"
          onClick={() => {
            setPick(current.id);
            review.approveAll(day.items);
          }}
        >
          {approveAllLabel(day.items.length)} for {formatWeekday(day.day)}
        </Button>
      </div>
    ) : null;

  const position = `${index + 1} of ${known.length}`;

  return (
    <AppFrame>
      <OutcomeContext.Provider value={review.outcomes}>
        <div className="flex flex-col gap-5">
          <PageTitle title="Review" />

          {current && (
            <Enter index={1} className="flex items-center gap-2">
              <IconButton
                icon={ChevronLeft}
                label="Previous"
                className="disabled:cursor-not-allowed disabled:opacity-35"
                disabled={!prev}
                onClick={() => prev && setPick(prev)}
              />
              <button
                type="button"
                className="nx-press flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-2 rounded-nx-sm px-2 py-1.5 hover:bg-nx-accent-soft"
                onClick={() => setListOpen(true)}
              >
                <span className="flex w-full gap-1.5" aria-hidden="true">
                  {known.map((id) => (
                    <span
                      key={id}
                      className={cn(
                        'h-2 flex-1 rounded-full transition-colors duration-300 ease-nx',
                        !open.has(id)
                          ? 'bg-nx-done-bar'
                          : id === currentId
                            ? 'bg-nx-accent'
                            : 'bg-nx-sunken',
                      )}
                    />
                  ))}
                </span>
                <span className="text-nx-2 font-semibold text-nx-accent">
                  {position} · See all
                </span>
              </button>
              <IconButton
                icon={ChevronRight}
                label="Next"
                className="disabled:cursor-not-allowed disabled:opacity-35"
                disabled={!next}
                onClick={() => next && setPick(next)}
              />
            </Enter>
          )}

          <Enter index={2}>
            <Deck id={current?.id ?? null} direction={shown.direction}>
              {current && (
                <GlassCard pad="lg" as="article">
                  <ItemBody world={world} item={current} size="lg" showDay />
                  {approveDay}
                </GlassCard>
              )}
            </Deck>
            {!current && <CaughtUp world={world} />}
          </Enter>

          <Enter index={3}>
            <WaitingForPartner review={review} />
          </Enter>

          {current && (
            <ActionBar className="flex-row-reverse items-stretch">
              <Button
                variant="primary"
                size="lg"
                icon={
                  current.kind === 'answer' || current.kind === 'correction'
                    ? Check
                    : undefined
                }
                className="flex-1 px-3"
                onClick={() => decide(current, true)}
              >
                {ACTIONS[current.kind].main}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                className="flex-1 px-3"
                onClick={() => decide(current, false)}
              >
                {ACTIONS[current.kind].alt}
              </Button>
            </ActionBar>
          )}
        </div>
      </OutcomeContext.Provider>

      <Sheet
        open={listOpen}
        onOpenChange={setListOpen}
        title="Waiting for you"
        footer={
          <Button variant="primary" onClick={() => setListOpen(false)}>
            Done
          </Button>
        }
      >
        <ul className="flex flex-col gap-2.5">
          {todo.map((item) => (
            <li key={item.id}>
              <RowButton
                glass={false}
                leading={
                  <Avatar
                    person={item.kind === 'dispute' ? world.me : world.partner}
                    size="sm"
                    decorative
                  />
                }
                title={shortTitle(item.rule)}
                detail={`${KIND[item.kind]} · ${formatDayShort(dayOf(item))}`}
                trailing={
                  item.id === currentId ? (
                    <StatusPill status="open" label="On screen" />
                  ) : undefined
                }
                aria-current={item.id === currentId || undefined}
                onClick={() => {
                  setPick(item.id);
                  setListOpen(false);
                }}
              />
            </li>
          ))}
        </ul>
      </Sheet>
      <DisputeSheet sheet={disputing} review={review} />
      <ReplySheet sheet={replying} review={review} />
    </AppFrame>
  );
}
