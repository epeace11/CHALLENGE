// Version 3: the whole day as a list. Open check-ins open in place one at a time; a saved one moves to Answered.
'use client';
import { useCallback, useId, useRef, useState, type Ref } from 'react';
import { ArrowRight, Check, ChevronRight, CircleCheckBig } from 'lucide-react';
import { AppFrame } from '@/components/next/frames';
import { useNav } from '@/components/next/nav';
import {
  Button,
  DURATION,
  EASE,
  EmptyState,
  GlassCard,
  Item,
  PageTitle,
  Presence,
  Section,
  StatusPill,
  motion,
  useReducedMotion,
} from '@/components/next/ui';
import type { Rule } from '@/lib/next/model';
import { entryPill, formatDay, formatWeekday } from '@/lib/next/selectors';
import { cn } from '@/lib/utils';
import { ClosedDay } from './closed-day';
import { DayChips, DaySheet, answerText } from './days';
import { GROUP_ICON } from './icons';
import { DayJournal } from './journal';
import { QuestionFields, QuestionHead, SaveHint } from './question';
import { useCheckin, type Checkin } from './use-checkin';
import styles from './log.module.css';

export default function LogV3() {
  const top = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  // A card gliding away unmounts after the next one mounts; keep pointing at the newest heading.
  const placeHeading = useCallback((el: HTMLHeadingElement | null) => {
    if (el) heading.current = el;
  }, []);
  const ci = useCheckin({ top, heading });
  const { navigate } = useNav();
  const [days, setDays] = useState(false);
  const { day, current } = ci;

  if (!day)
    return (
      <AppFrame>
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
      </AppFrame>
    );

  const answered = ci.rules.filter((r) => !ci.open.some((o) => o.id === r.id));
  const done = ci.left === 0;

  return (
    <AppFrame>
      {ci.late ? (
        <ClosedDay ci={ci} onDays={() => setDays(true)} />
      ) : (
        <div className="flex flex-col gap-7 pb-2">
          <div className="flex flex-col gap-5">
            <PageTitle
              kicker="Check in"
              title={formatDay(day)}
              detail={`Answer by ${ci.lockLabel(day)}.`}
            />
            <Section index={1}>
              <DayChips
                ci={ci}
                onEarlier={() => setDays(true)}
                onCurrent={ci.showCurrent}
              />
            </Section>
          </div>

          {done && !current && (
            <Section index={2}>
              <GlassCard pad="lg" className="flex flex-col gap-5">
                <div className="flex items-center gap-4">
                  <span className={styles.doneMark}>
                    <Check size={30} strokeWidth={2.4} aria-hidden="true" />
                  </span>
                  <div className="flex min-w-0 flex-col gap-1">
                    <h2
                      ref={placeHeading}
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
              </GlassCard>
            </Section>
          )}

          <div ref={top} className={cn(styles.anchor, 'flex flex-col gap-7')}>
            {!done && (
              <Section title="Left to answer" index={2}>
                <div className="relative flex flex-col gap-3">
                  <Presence mode="popLayout" initial={false}>
                    {ci.queue.map((r) => (
                      <Item key={r.id}>
                        <CheckItem
                          ci={ci}
                          rule={r}
                          open={r.id === current?.id}
                          headingRef={placeHeading}
                        />
                      </Item>
                    ))}
                  </Presence>
                </div>
              </Section>
            )}

            {answered.length > 0 && (
              <Section title="Answered" index={3}>
                <div className="relative flex flex-col gap-3">
                  <Presence mode="popLayout" initial={false}>
                    {answered.map((r) => (
                      <Item key={r.id}>
                        <CheckItem
                          ci={ci}
                          rule={r}
                          open={r.id === current?.id}
                          answered
                          headingRef={placeHeading}
                        />
                      </Item>
                    ))}
                  </Presence>
                </div>
              </Section>
            )}
          </div>

          <DayJournal day={day} index={4} />
        </div>
      )}
      <DaySheet ci={ci} open={days} onOpenChange={setDays} />
    </AppFrame>
  );
}

/** One check-in of the day: a row to tap, or the whole question when it is the one being answered. */
function CheckItem({
  ci,
  rule,
  open,
  answered,
  headingRef,
}: {
  ci: Checkin;
  rule: Rule;
  open: boolean;
  answered?: boolean;
  headingRef: Ref<HTMLHeadingElement>;
}) {
  const { navigate } = useNav();
  const still = useReducedMotion();
  const id = useId();
  const Icon = GROUP_ICON[rule.group];
  const entry = ci.entryOf(rule);
  const pill =
    answered && ci.day ? entryPill(ci.world, rule, entry, ci.day) : null;
  const tone =
    open || !pill
      ? undefined
      : pill.status === 'done' || pill.status === 'forgiven'
        ? 'done'
        : pill.status === 'missed' || pill.status === 'disputed'
          ? 'missed'
          : pill.status === 'none'
            ? 'none'
            : 'review';
  const head = (
    <>
      <span className={styles.itemIcon} data-tone={tone}>
        <Icon size={20} aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-nx-body font-semibold text-nx-ink">
          {rule.title}
        </span>
        {pill && !open && (
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-nx-2 text-nx-ink-2">
            <span>{answerText(rule, ci)}</span>
            {pill.status !== 'none' && (
              <StatusPill status={pill.status} label={pill.label} />
            )}
          </span>
        )}
      </span>
      {!open && (
        <ChevronRight className="nx-row-chevron" size={22} aria-hidden="true" />
      )}
    </>
  );

  return (
    <GlassCard
      as="article"
      pad="none"
      aria-labelledby={open ? id : undefined}
      className={styles.item}
    >
      {open ? (
        <div className={styles.itemHead}>{head}</div>
      ) : (
        <button
          type="button"
          className={cn(styles.itemHead, 'nx-press')}
          onClick={() => {
            if (entry?.status === 'disputed') navigate('review');
            else ci.openRule(rule.id);
          }}
        >
          {head}
        </button>
      )}
      <Presence initial={false}>
        {open && (
          <motion.div
            key="question"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: still ? 0 : DURATION.slow, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-7 border-t border-nx-line px-5 pt-5 pb-6 sm:px-6">
              {ci.changing && (
                <p className="text-nx-2 font-semibold text-nx-ink-2">
                  Changing your saved answer
                </p>
              )}
              <QuestionHead
                rule={rule}
                headingRef={headingRef}
                id={id}
                eyebrow={false}
              />
              <QuestionFields ci={ci} rule={rule} />
              <div className="flex flex-col gap-3">
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
            </div>
          </motion.div>
        )}
      </Presence>
    </GlassCard>
  );
}
