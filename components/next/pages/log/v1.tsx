// Version 1: step by step. What is left sits on top; one question card at a time, with Save on the card.
'use client';
import { useCallback, useId, useRef, useState, type Ref } from 'react';
import { ArrowRight, CalendarDays, Check, CircleCheckBig } from 'lucide-react';
import { AppFrame } from '@/components/next/frames';
import { useNav } from '@/components/next/nav';
import {
  Button,
  CountUp,
  EmptyState,
  GlassCard,
  Glide,
  IconButton,
  PageTitle,
  Section,
  TapCard,
} from '@/components/next/ui';
import type { Rule } from '@/lib/next/model';
import { formatDay, formatWeekday } from '@/lib/next/selectors';
import { cn } from '@/lib/utils';
import { Bar } from './bar';
import { ClosedDay } from './closed-day';
import { DayAnswers, DayListSheet, DaySheet } from './days';
import { DayJournal } from './journal';
import { QuestionFields, QuestionHead, SaveHint } from './question';
import { useCheckin, type Checkin } from './use-checkin';
import styles from './log.module.css';

export default function LogV1() {
  const top = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  // A card gliding away unmounts after the next one mounts; keep pointing at the newest heading.
  const placeHeading = useCallback((el: HTMLHeadingElement | null) => {
    if (el) heading.current = el;
  }, []);
  const ci = useCheckin({ top, heading });
  const [days, setDays] = useState(false);
  const [list, setList] = useState(false);
  const { day, current: rule } = ci;

  return (
    <AppFrame>
      {!day ? (
        <NothingOpen />
      ) : ci.late ? (
        <ClosedDay ci={ci} onDays={() => setDays(true)} />
      ) : (
        <div className="flex flex-col gap-6 pb-2">
          <PageTitle
            kicker="Check in"
            title={formatDay(day)}
            action={
              <IconButton
                icon={CalendarDays}
                label="Other days"
                aria-haspopup="dialog"
                onClick={() => setDays(true)}
              />
            }
          />

          {ci.left > 0 && (
            <Section index={1}>
              <TapCard onClick={() => setList(true)} aria-haspopup="dialog">
                <span className="flex items-baseline gap-2.5">
                  <span className="font-nx-serif text-nx-num text-nx-accent">
                    <CountUp value={ci.left} />
                  </span>
                  <span className="text-nx-lead font-semibold text-nx-ink">
                    left
                  </span>
                </span>
                <span className="mt-1 block text-nx-2 text-nx-ink-2">
                  Until {ci.lockLabel(day)} · {ci.timeLeftLabel} to go
                </span>
                <Bar className="mt-4" value={ci.answered} max={ci.due} />
              </TapCard>
            </Section>
          )}

          <div ref={top} className={cn(styles.anchor, styles.clipX)}>
            <Glide
              id={rule ? `${day}|${rule.id}` : `${day}|done`}
              direction={ci.direction}
            >
              {rule ? (
                <QuestionCard ci={ci} rule={rule} headingRef={placeHeading} />
              ) : (
                <DoneCard ci={ci} headingRef={placeHeading} />
              )}
            </Glide>
          </div>

          <DayJournal day={day} index={3} />
        </div>
      )}
      <DaySheet ci={ci} open={days} onOpenChange={setDays} />
      <DayListSheet ci={ci} open={list} onOpenChange={setList} />
    </AppFrame>
  );
}

function QuestionCard({
  ci,
  rule,
  headingRef,
}: {
  ci: Checkin;
  rule: Rule;
  headingRef: Ref<HTMLHeadingElement>;
}) {
  const id = useId();
  return (
    <GlassCard
      as="section"
      pad="lg"
      aria-labelledby={id}
      className="flex flex-col gap-7"
    >
      <div className="flex flex-col gap-3">
        {ci.changing && (
          <p className="text-nx-2 font-semibold text-nx-ink-2">
            Changing your saved answer
          </p>
        )}
        <QuestionHead rule={rule} headingRef={headingRef} id={id} />
      </div>
      <QuestionFields ci={ci} rule={rule} />
      <div className="flex flex-col gap-3 border-t border-nx-line pt-5">
        <SaveHint ci={ci} rule={rule} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          {ci.changing ? (
            <Button onClick={ci.cancel}>Cancel</Button>
          ) : ci.left > 1 ? (
            <Button variant="quiet" onClick={() => ci.skip(rule)}>
              Skip for now
            </Button>
          ) : null}
          <Button
            variant="primary"
            size="lg"
            icon={Check}
            className="w-full sm:w-auto sm:min-w-44"
            disabled={!ci.canSave(rule)}
            onClick={() => ci.save(rule)}
          >
            Save
          </Button>
        </div>
      </div>
    </GlassCard>
  );
}

function DoneCard({
  ci,
  headingRef,
}: {
  ci: Checkin;
  headingRef: Ref<HTMLHeadingElement>;
}) {
  const { navigate } = useNav();
  const day = ci.day ?? '';
  return (
    <GlassCard as="section" pad="lg" className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <span className={styles.doneMark}>
          <Check size={30} strokeWidth={2.4} aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="font-nx-serif text-nx-h2 outline-none"
          >
            {formatWeekday(day)} is logged
          </h2>
          <p className="text-nx-body text-nx-ink-2">
            You can change an answer until {ci.lockLabel(day)}.
          </p>
        </div>
      </div>
      <Button
        variant="primary"
        size="lg"
        full
        iconEnd={ArrowRight}
        onClick={() => navigate('overview')}
      >
        Go to Overview
      </Button>
      <div className="flex flex-col gap-2.5">
        <h3 className="font-nx-sans text-nx-2 font-semibold text-nx-ink-2">
          Your answers
        </h3>
        <DayAnswers ci={ci} />
      </div>
    </GlassCard>
  );
}

function NothingOpen() {
  const { navigate } = useNav();
  return (
    <GlassCard pad="lg" className="mt-4">
      <EmptyState
        icon={CircleCheckBig}
        title="Nothing to check in"
        action={
          <Button variant="primary" onClick={() => navigate('overview')}>
            Go to Overview
          </Button>
        }
      >
        The next day opens at midnight.
      </EmptyState>
    </GlassCard>
  );
}
