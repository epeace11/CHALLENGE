// Version 2: the whole day on one page. Your answers, Jordan's review and the gift appear one under the other as a timeline, with the next action pinned at the bottom.
'use client';
import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { ArrowRight, Check, RotateCcw, UserPlus } from 'lucide-react';
import { PlainFrame } from '@/components/next/frames';
import { useNav } from '@/components/next/nav';
import {
  ActionBar,
  Button,
  GlassCard,
  Item,
  PageTitle,
  Presence,
  useReducedMotion,
} from '@/components/next/ui';
import { cn } from '@/lib/utils';
import {
  GiftSteps,
  HowPointsSheet,
  MissLine,
  PartnerReview,
  PracticeBanner,
  Question,
} from './parts';
import {
  answerText,
  costButton,
  isAnswered,
  shortTitle,
  usePractice,
  type Phase,
} from './script';
import styles from './practice.module.css';

type State = 'done' | 'now' | 'next';

/** One part of the day on the timeline: a node on the rail, a title, and what happened in it. */
function Step({
  state,
  title,
  preview,
  last,
  anchor,
  headingId,
  children,
}: {
  state: State;
  title: string;
  /** What this part will show, while it is still ahead. */
  preview?: string;
  last?: boolean;
  anchor?: Ref<HTMLLIElement>;
  /** Lets the page move focus to this part's title when it starts. */
  headingId?: string;
  children?: ReactNode;
}) {
  return (
    <li
      ref={anchor}
      className="relative grid scroll-mt-36 grid-cols-[32px_minmax(0,1fr)] gap-x-4"
      aria-current={state === 'now' ? 'step' : undefined}
    >
      {!last && (
        <span
          className={styles.rail}
          data-done={state === 'done' || undefined}
          aria-hidden="true"
        />
      )}
      <span
        className={cn(
          'relative z-[1] grid size-8 place-items-center rounded-full transition-colors duration-300 ease-nx',
          state === 'done' &&
            'text-nx-on-accent [background:var(--nx-primary)]',
          state === 'now' && 'border-2 border-nx-accent bg-nx-surface',
          state === 'next' && 'border-2 border-nx-line-strong bg-nx-surface',
        )}
        aria-hidden="true"
      >
        {state === 'done' ? (
          <Check size={18} strokeWidth={2.6} />
        ) : state === 'now' ? (
          <span className="size-3 rounded-full bg-nx-accent" />
        ) : null}
      </span>
      <div className="flex min-w-0 flex-col gap-4">
        <div>
          <h2
            id={headingId}
            tabIndex={headingId ? -1 : undefined}
            className={cn(
              'font-nx-serif text-nx-h3 leading-8',
              state === 'next' ? 'text-nx-ink-2' : 'text-nx-ink',
            )}
          >
            {title}
            <span className="sr-only">
              {state === 'done' ? ', done' : state === 'now' ? ', now' : ''}
            </span>
          </h2>
          {state === 'next' && preview && (
            <p className="text-nx-2 text-nx-ink-2">{preview}</p>
          )}
        </div>
        {children}
      </div>
    </li>
  );
}

const ORDER: Phase[] = ['answer', 'review', 'gift'];

/** Practice day, version 2. */
export default function PracticeV2() {
  const p = usePractice();
  const { navigate } = useNav();
  const reduced = useReducedMotion();
  const [how, setHow] = useState(false);
  const review = useRef<HTMLLIElement>(null);
  const gift = useRef<HTMLLIElement>(null);
  const question = useRef<HTMLDivElement>(null);
  const partner = p.world.partner.name;
  const at = ORDER.indexOf(p.phase);
  const state = (phase: Phase): State => {
    const i = ORDER.indexOf(phase);
    return i < at ? 'done' : i === at ? 'now' : 'next';
  };

  // Bring whatever just appeared into view (the next question, the review, the gift) and move
  // focus to its heading, so keyboard and screen reader users follow along.
  useEffect(() => {
    const behavior = reduced ? 'auto' : 'smooth';
    const focus = (id: string) =>
      document.getElementById(id)?.focus({ preventScroll: true });
    if (p.phase === 'review') {
      review.current?.scrollIntoView({ behavior });
      focus('practice-review');
    } else if (p.phase === 'gift') {
      gift.current?.scrollIntoView({ behavior });
      focus('practice-gift');
    } else if (p.saved > 0) {
      question.current?.scrollIntoView({ behavior, block: 'nearest' });
      focus(`practice-question-${p.saved}`);
    } else if (p.run > 0) {
      window.scrollTo({ top: 0, behavior });
      focus('practice-question-0');
    }
  }, [p.phase, p.saved, p.run, reduced]);

  const i = p.current;
  const action =
    p.phase === 'answer' ? (
      <Button
        variant="primary"
        size="lg"
        full
        disabled={!isAnswered(p.questions[i].rule, p.answers[i])}
        onClick={p.save}
      >
        Save
      </Button>
    ) : p.phase === 'review' ? (
      <Button
        variant="primary"
        size="lg"
        full
        iconEnd={ArrowRight}
        onClick={p.toGift}
      >
        {costButton(p.result.misses.length)}
      </Button>
    ) : (
      <>
        <Button
          variant="primary"
          size="lg"
          full
          icon={UserPlus}
          onClick={() => navigate('invite')}
        >
          Invite {partner} for real
        </Button>
        <Button variant="quiet" icon={RotateCcw} onClick={p.restart}>
          Practice again
        </Button>
      </>
    );

  return (
    <PlainFrame back={{ to: 'setup' }}>
      <div className="flex flex-col gap-6">
        <PracticeBanner className={styles.sticky} />
        <PageTitle title="Practice day" />

        <ol className="flex flex-col gap-7" key={p.run}>
          <Step state={state('answer')} title="Answer three check-ins">
            {p.saved > 0 && (
              <div className="relative flex flex-col gap-2">
                <Presence mode="popLayout" initial={false}>
                  {p.questions.slice(0, p.saved).map((q, n) => (
                    <Item key={q.rule.id}>
                      <div className="flex items-center gap-3 rounded-nx border border-nx-line bg-nx-surface-2 px-4 py-3">
                        <Check
                          size={18}
                          strokeWidth={2.6}
                          className="shrink-0 text-nx-done"
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1 text-nx-body text-nx-ink">
                          {shortTitle(q.rule)}
                        </span>
                        <span className="shrink-0 text-nx-2 text-nx-ink-2">
                          {answerText(q.rule, p.answers[n])}
                        </span>
                      </div>
                    </Item>
                  ))}
                </Presence>
              </div>
            )}
            {p.phase === 'answer' && (
              <div ref={question} className="scroll-mb-40">
                {p.saved === 0 && (
                  <p className="mb-3 text-nx-2 text-nx-ink-2">
                    Sample answers are filled in. Change any of them.
                  </p>
                )}
                <GlassCard key={i} pad="lg" className="nx-enter">
                  <Question
                    p={p}
                    index={i}
                    headingId={`practice-question-${i}`}
                  />
                </GlassCard>
              </div>
            )}
          </Step>

          <Step
            state={state('review')}
            title={`${partner} reviews them`}
            preview={`${partner} approves or disputes each Yes.`}
            anchor={review}
            headingId="practice-review"
          >
            {p.phase !== 'answer' && (
              <div className="nx-enter">
                <PartnerReview p={p} />
              </div>
            )}
          </Step>

          <Step
            state={state('gift')}
            title="What a miss costs"
            preview="Each miss is a point, and points set the gift you buy."
            anchor={gift}
            headingId="practice-gift"
            last
          >
            {p.phase === 'gift' && (
              <div className="nx-enter flex flex-col gap-4">
                <MissLine p={p} heading={false} />
                <GiftSteps p={p} onHow={() => setHow(true)} />
              </div>
            )}
          </Step>
        </ol>

        <ActionBar>{action}</ActionBar>
      </div>
      <HowPointsSheet open={how} onOpenChange={setHow} />
    </PlainFrame>
  );
}
