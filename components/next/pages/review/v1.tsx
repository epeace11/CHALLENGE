// One thing at a time on a big card with a large screenshot; an answer's two buttons stay pinned below it, forgiveness and disputes decide in the card, and each decision can be undone for a moment.
'use client';
import { useRef, useState, type ReactNode } from 'react';
import { Check, CheckCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { AppFrame } from '@/components/next/frames';
import { HostedWorld } from '@/components/next/world';
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
import { formatDayShort } from '@/lib/next/selectors';
import { cn } from '@/lib/utils';
import { Deck, OutcomeContext, STAMP, type Outcome } from './motion';
import {
  ApproveDaySheet,
  CaughtUp,
  DisputeSheet,
  ItemBody,
  ReplySheet,
  UndoLine,
  WaitingForPartner,
  cardHeading,
  showCard,
  useFocusLater,
  useSheetFor,
} from './parts';
import {
  actionsFor,
  approveAllLabel,
  shortTitle,
  type AnswerItem,
  type DayGroup,
  type DisputeItem,
  type ReviewItem,
} from './queue';
import { PointActions } from './points';
import { useReview } from './use-review';

const KIND: Record<ReviewItem['kind'], string> = {
  answer: 'Answer',
  correction: 'Late answer',
  forgiveness: 'Forgiveness',
  dispute: 'Dispute on your answer',
};

const dayOf = (item: ReviewItem) =>
  item.kind === 'forgiveness' ? item.point.day : item.entry.day;

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
  const [waitingOpen, setWaitingOpen] = useState(false);
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
  const approving = useSheetFor<DayGroup>();
  const actions = current && actionsFor(current.kind);
  // An answer's Approve and Dispute stay pinned below the card; forgiveness and disputes, whose
  // choices move money, decide in the card, so the pinned bar never turns into Forgive or Concede.
  const inBar = current?.kind === 'answer' || current?.kind === 'correction';
  // Taps in the moment after a decision are ignored, so a double tap can't decide the next card.
  const settle = useRef(0);

  // After each decision (and Undo) focus moves to the heading of the card now on screen, or to
  // "All caught up", instead of dropping to the page; after a sheet, once the sheet has gone. The
  // page scrolls so the Undo line above the card shows too, even after a decision made far down a
  // tall card (`showCard` focuses the heading itself, so nothing is left for focusLater to focus).
  const page = useRef<HTMLDivElement>(null);
  const stack = useRef<HTMLDivElement>(null);
  const focusLater = useFocusLater();
  const focusCard = () =>
    focusLater(() => {
      showCard(stack.current, cardHeading(page.current));
      return null;
    });

  /** Acts on the card on screen, remembering it so the next open one follows. */
  const decide = (item: ReviewItem, main: boolean) => {
    if (performance.now() < settle.current) return;
    settle.current = performance.now() + 600;
    setPick(item.id);
    if (item.kind === 'answer') {
      if (!main) return disputing.show(item);
      review.approve(item);
    } else if (item.kind === 'correction') {
      if (main) review.approve(item);
      else review.declineLate(item);
    } else if (item.kind === 'forgiveness') {
      if (main) review.forgive(item);
      else review.decline(item);
    } else {
      if (main) return replying.show(item);
      review.concede(item);
    }
    focusCard();
  };

  // "Approve both" on an answer card while its day has several answers waiting: it opens them all
  // first, so nothing is approved unseen.
  const day =
    current?.kind === 'answer'
      ? state.days.find((g) => g.day === current.entry.day)
      : undefined;
  const approveDay =
    current && day && day.items.length > 1 ? (
      <div className="mt-6 border-t border-nx-line pt-3">
        {/* The card's kicker has the day, so the button names the answers instead. */}
        <Button
          variant="quiet"
          icon={CheckCheck}
          className="-ml-3"
          onClick={() => approving.show(day)}
        >
          {approveAllLabel(day.items.length)} answers
        </Button>
      </div>
    ) : null;
  const approveGroup = (group: DayGroup) => {
    approving.setOpen(false);
    if (current) setPick(current.id);
    review.approveAll(group.items);
    focusCard();
  };

  const position = `${index + 1} of ${known.length}`;
  // Each step of the strip: the card on screen (accent), one still to do, or one decided, coloured
  // by how it was decided (done, missed or waiting, as in STAMP).
  const stepColour = (id: string) => {
    if (open.has(id)) return id === currentId ? 'bg-nx-accent' : 'bg-nx-sunken';
    const outcome: Outcome | undefined = review.outcomes[id];
    // Gone some other way (the partner withdrew a dispute): it costs nothing.
    return outcome ? STAMP[outcome].bar : 'bg-nx-done-bar';
  };

  // The frame reads the world as this page shows it, so the Review badge counts a decision waiting
  // in its Undo window as made, like the strip and the card do. It only shows: every change still
  // goes through `review`, made above it (in the preview, useBackend() called below it can't write).
  return (
    <HostedWorld world={world}>
      <AppFrame>
        <OutcomeContext.Provider value={review.outcomes}>
          <div ref={page} className="flex flex-col gap-5">
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
                          stepColour(id),
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
              {/* What `showCard` keeps on screen after a decision, from its top (the Undo line) down to
                  the card's heading: its scroll margins clear the preview's bar and, from 1024px, the
                  sticky header above, and the pinned buttons and tab bar below. */}
              <div
                ref={stack}
                className="flex scroll-mt-[calc(var(--nx-top-inset)_+_var(--nx-header-h,0px)_+_0.75rem)] scroll-mb-[calc(var(--nx-nav-h)_+_var(--nx-action-h,0px)_+_0.75rem)] flex-col gap-3"
              >
                {review.held && review.held.from !== 'points' && (
                  <UndoLine
                    held={review.held}
                    onUndo={() => {
                      review.undo();
                      focusCard();
                    }}
                    onPause={review.pause}
                  />
                )}
                <Deck id={current?.id ?? null} direction={shown.direction}>
                  {current && (
                    <GlassCard pad="lg" as="article">
                      <ItemBody
                        world={world}
                        item={current}
                        size="lg"
                        showDay
                        eager={index === 0}
                      />
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
                {!current && (
                  <CaughtUp
                    world={world}
                    onWaiting={() => setWaitingOpen(true)}
                  />
                )}
              </div>
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
              <WaitingForPartner
                review={review}
                open={waitingOpen}
                setOpen={setWaitingOpen}
              />
            </Enter>

            <Enter index={4}>
              <PointActions review={review} />
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
                      person={
                        item.kind === 'dispute' ? world.me : world.partner
                      }
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
        <DisputeSheet sheet={disputing} review={review} onDone={focusCard} />
        <ReplySheet sheet={replying} review={review} onDone={focusCard} />
        <ApproveDaySheet
          sheet={approving}
          world={world}
          onApprove={approveGroup}
        />
      </AppFrame>
    </HostedWorld>
  );
}
