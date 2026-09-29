// Version 1: everything on one page, answers grouped by day; the first card has the filled button, "Approve both" sits in the day's heading.
'use client';
import { useRef, type ReactElement } from 'react';
import { Check, CheckCheck } from 'lucide-react';
import { AppFrame } from '@/components/next/frames';
import { Button, Enter, GlassCard, PageTitle } from '@/components/next/ui';
import { ClearItem, ClearList, OutcomeContext } from './motion';
import {
  AnswerBody,
  CaughtUp,
  Choices,
  DayHeader,
  DisputeBody,
  DisputeSheet,
  ForgivenessBody,
  ReplySheet,
  WaitingForPartner,
  useRefocus,
  useSheetFor,
} from './parts';
import {
  ACTIONS,
  approveAllLabel,
  type AnswerItem,
  type DisputeItem,
} from './queue';
import { useReview } from './use-review';

/** Review, version 1. */
export default function ReviewV1() {
  const review = useReview();
  const { world, state } = review;
  const disputing = useSheetFor<AnswerItem>();
  const replying = useSheetFor<DisputeItem>();
  const list = useRef<HTMLDivElement>(null);
  useRefocus(list, state.todo.length);

  // The one filled button belongs to whatever comes first; "Approve both" stays outlined in
  // the day's heading, so both show on the first screen.
  const next = state.todo[0]?.id;

  const blocks: ReactElement[] = [];
  for (const group of state.days) {
    const several = group.items.length > 1;
    blocks.push(
      <ClearItem key={`day:${group.day}`} id={`day:${group.day}`} space="sm">
        <DayHeader
          world={world}
          day={group.day}
          action={
            several ? (
              <Button
                icon={CheckCheck}
                className="px-4"
                onClick={() => review.approveAll(group.items)}
              >
                {approveAllLabel(group.items.length)}
              </Button>
            ) : undefined
          }
        />
      </ClearItem>,
    );
    group.items.forEach((item, i) =>
      blocks.push(
        <ClearItem
          key={item.id}
          id={item.id}
          space={i === group.items.length - 1 ? 'lg' : 'md'}
        >
          <GlassCard as="article">
            <AnswerBody world={world} item={item} />
            <Choices
              className="mt-6"
              next={next === item.id}
              main={{
                label: 'Approve',
                icon: Check,
                onClick: () => review.approve(item),
              }}
              alt={{ label: 'Dispute', onClick: () => disputing.show(item) }}
            />
          </GlassCard>
        </ClearItem>,
      ),
    );
  }
  for (const item of state.late)
    blocks.push(
      <ClearItem key={item.id} id={item.id}>
        <GlassCard as="article">
          <AnswerBody world={world} item={item} />
          <Choices
            className="mt-6"
            next={next === item.id}
            main={{
              label: ACTIONS.correction.main,
              icon: Check,
              onClick: () => review.approve(item),
            }}
            alt={{
              label: ACTIONS.correction.alt,
              onClick: () => review.declineLate(item),
            }}
          />
        </GlassCard>
      </ClearItem>,
    );
  for (const item of state.forgiveness)
    blocks.push(
      <ClearItem key={item.id} id={item.id}>
        <GlassCard as="article">
          <ForgivenessBody world={world} item={item} />
          <Choices
            className="mt-6"
            next={next === item.id}
            main={{
              label: ACTIONS.forgiveness.main,
              onClick: () => review.forgive(item),
            }}
            alt={{
              label: ACTIONS.forgiveness.alt,
              onClick: () => review.decline(item),
            }}
          />
        </GlassCard>
      </ClearItem>,
    );
  for (const item of state.disputes)
    blocks.push(
      <ClearItem key={item.id} id={item.id}>
        <GlassCard as="article">
          <DisputeBody world={world} item={item} />
          <Choices
            className="mt-6"
            next={next === item.id}
            main={{
              label: ACTIONS.dispute.main,
              onClick: () => review.concede(item),
            }}
            alt={{
              label: ACTIONS.dispute.alt,
              onClick: () => replying.show(item),
            }}
          />
        </GlassCard>
      </ClearItem>,
    );

  return (
    <AppFrame>
      <OutcomeContext.Provider value={review.outcomes}>
        <div className="flex flex-col gap-6 pb-4">
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
        </div>
      </OutcomeContext.Provider>

      <DisputeSheet sheet={disputing} review={review} />
      <ReplySheet sheet={replying} review={review} />
    </AppFrame>
  );
}
