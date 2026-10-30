// One thing at a time on a big card with a large screenshot; an answer's two buttons stay pinned below it, forgiveness and disputes decide in the card, and each decision can be undone for a moment.
'use client';
import { useRef, useState, type ReactNode } from 'react';
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
import { Deck, OutcomeContext, STAMP } from './motion';
import {
  CaughtUp,
  DisputeSheet,
  ItemBody,
  ReplySheet,
  WaitingForPartner,
  useSheetFor,
} from './parts';
import {
  actionsFor,
  approveAllLabel,
  shortTitle,
  type AnswerItem,
  type DisputeItem,
  type ReviewItem,
} from './queue';
import { PointActions } from './points';
import { useReview, type Held } from './use-review';

const KIND: Record<ReviewItem['kind'], string> = {
  answer: 'Answer',
  correction: 'Late answer',
  forgiveness: 'Forgiveness',
  dispute: 'Dispute on your answer',
};

const dayOf = (item: ReviewItem) =>
  item.kind === 'forgiveness' ? item.point.day : item.entry.day;

/**
 * The decision just made, with Undo while it waits to be sent: on the page, above the next card,
 * never a pop-up. A screen reader hears the decision.
 */
function UndoLine({ held, onUndo }: { held: Held; onUndo: () => void }) {
  const s = STAMP[held.outcome];
  const Icon = s.icon;
  return (
    <div
      className={cn(
        'nx-enter flex min-h-12 items-center gap-3 rounded-nx py-1 pr-1 pl-4',
        s.tint,
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
      <Button variant="quiet" onClick={onUndo}>
        Undo
      </Button>
    </div>
  );
}

/** Two decision buttons side by side: the other choice first, the main one on the right. */
function Choices({
  main,
  alt,
  mainIcon,
  onMain,
  onAlt,
}: {
  main: string;
  alt: string;
  mainIcon?: typeof Check;
  onMain: () => void;
  onAlt: () => void;
}): ReactNode {
  return (
    <>
      <Button
        variant="secondary"
        size="lg"
        className="flex-1 px-3"
        onClick={onAlt}
      >
        {alt}
      </Button>
      <Button
        variant="primary"
        size="lg"
        icon={mainIcon}
        className="flex-1 px-3"
        onClick={onMain}
      >
        {main}
      </Button>
    </>
  );
}

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
  const actions = current && actionsFor(current.kind, world.partner.name);
  // An answer's Approve and Dispute stay pinned below the card; forgiveness and disputes, whose
  // choices move money, decide in the card, so the pinned bar never turns into Forgive or Concede.
  const inBar = current?.kind === 'answer' || current?.kind === 'correction';
  // Taps in the moment after a decision are ignored, so a double tap can't decide the next card.
  const settle = useRef(0);

  /** Acts on the card on screen, remembering it so the next open one follows. */
  const decide = (item: ReviewItem, main: boolean) => {
    if (performance.now() < settle.current) return;
    settle.current = performance.now() + 600;
    setPick(item.id);
    if (item.kind === 'answer')
      return main ? review.approve(item) : disputing.show(item);
    if (item.kind === 'correction')
      return main ? review.approve(item) : review.declineLate(item);
    if (item.kind === 'forgiveness')
      return main ? review.forgive(item) : review.decline(item);
    return main ? replying.show(item) : review.concede(item);
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

          <Enter index={2} className="flex flex-col gap-3">
            {review.held && (
              <UndoLine held={review.held} onUndo={review.undo} />
            )}
            <Deck id={current?.id ?? null} direction={shown.direction}>
              {current && (
                <GlassCard pad="lg" as="article">
                  <ItemBody world={world} item={current} size="lg" showDay />
                  {approveDay}
                  {!inBar && actions && (
                    <div className="mt-6 flex items-stretch gap-2">
                      <Choices
                        main={actions.main}
                        alt={actions.alt}
                        onMain={() => decide(current, true)}
                        onAlt={() => decide(current, false)}
                      />
                    </div>
                  )}
                </GlassCard>
              )}
            </Deck>
            {!current && <CaughtUp world={world} />}
          </Enter>

          {/* Right after the card, so it comes next for a keyboard and scrolls away with the card. */}
          {current && inBar && actions && (
            <ActionBar className="flex-row items-stretch">
              <Choices
                main={actions.main}
                alt={actions.alt}
                mainIcon={Check}
                onMain={() => decide(current, true)}
                onAlt={() => decide(current, false)}
              />
            </ActionBar>
          )}

          <Enter index={3}>
            <WaitingForPartner review={review} />
          </Enter>

          <Enter index={4}>
            <PointActions world={world} />
          </Enter>
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
