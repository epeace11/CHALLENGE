// The whole day as a timeline: your answers, Jordan's review, your review of Jordan's answers and the gift. Only the step under way is open, so each fits a phone; the next action is pinned at the bottom.
'use client';
import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { ArrowRight, Check, RotateCcw, UserPlus } from 'lucide-react';
import { PlainFrame } from '@/components/next/frames';
import { useBackend } from '@/components/next/backend';
import { useNav } from '@/components/next/nav';
import {
  ActionBar,
  Button,
  GlassCard,
  ProgressBar,
  ReasonSheet,
  StatusPill,
  useReducedMotion,
} from '@/components/next/ui';
import { cn } from '@/lib/utils';
import {
  AnswerToReview,
  GiftSteps,
  HowPointsSheet,
  MissLine,
  PartnerReview,
  PracticeBanner,
  Question,
} from './parts';
import {
  capital,
  isAnswered,
  needsShot,
  partnerAnswerText,
  shortTitle,
  usePractice,
  type Phase,
} from './script';
import styles from './practice.module.css';

type State = 'done' | 'now' | 'next';

/**
 * One part of the day on the timeline: a node on the rail, a title, and while it is under way what
 * happens in it. A part still ahead is only its title, so the part under way fits a phone.
 */
function Step({
  state,
  title,
  aside,
  last,
  anchor,
  headingId,
  children,
}: {
  state: State;
  title: string;
  /** Something small on the title's row (how many are saved). */
  aside?: ReactNode;
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
          state === 'done' && 'text-nx-on-accent [background:var(--nx-fill)]',
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
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center gap-3">
          <h2
            id={headingId}
            tabIndex={headingId ? -1 : undefined}
            className={cn(
              'min-w-0 flex-1 font-nx-serif text-nx-h3 leading-8',
              state === 'next' ? 'text-nx-ink-2' : 'text-nx-ink',
            )}
          >
            {title}
            {/* The current part is announced by aria-current on the item, so only a finished one says so here. */}
            {state === 'done' && <span className="sr-only">, done</span>}
          </h2>
          {aside}
        </div>
        {children}
      </div>
    </li>
  );
}

const ORDER: Phase[] = ['answer', 'review', 'yours', 'gift'];

/** Practice day. */
export default function PracticeV1() {
  const p = usePractice();
  const { navigate } = useNav();
  const reduced = useReducedMotion();
  const toReview = p.world.practice.partnerAnswers;
  const reviewing = toReview[p.decided.length];
  const [how, setHow] = useState(false);
  /** The partner's answer being disputed: kept while its sheet closes, so the sheet slides away. */
  const [disputed, setDisputed] = useState<(typeof toReview)[number] | null>(
    null,
  );
  const [disputing, setDisputing] = useState(false);
  /** Save pressed before the question was answered: what's missing, said beside Save. */
  const [early, setEarly] = useState<number | null>(null);
  const review = useRef<HTMLLIElement>(null);
  const yours = useRef<HTMLLIElement>(null);
  const gift = useRef<HTMLLIElement>(null);
  const question = useRef<HTMLDivElement>(null);
  const partner = p.world.partner.name,
    Partner = capital(partner);
  // In the live app the partner may already be in; the button then goes back to the challenge.
  const { live } = useBackend();
  const joined = live && !p.world.partnerPending;
  const at = ORDER.indexOf(p.phase);
  const state = (phase: Phase): State => {
    const i = ORDER.indexOf(phase);
    return i < at ? 'done' : i === at ? 'now' : 'next';
  };

  // Bring whatever just appeared into view (the next question, the review, the partner's next
  // answer, the gift) and move focus to its heading, so keyboard and screen reader users follow.
  useEffect(() => {
    const behavior = reduced ? 'auto' : 'smooth';
    // A closing sheet (the dispute) hands focus back as it goes, so focus waits until it's gone.
    let frame = 0,
      frames = 90;
    const focus = (id: string) => {
      const step = () => {
        if (document.querySelector('.nx-sheet') && frames-- > 0) {
          frame = requestAnimationFrame(step);
          return;
        }
        document.getElementById(id)?.focus({ preventScroll: true });
      };
      frame = requestAnimationFrame(step);
    };
    if (p.phase === 'review') {
      review.current?.scrollIntoView({ behavior });
      focus('practice-review');
    } else if (p.phase === 'yours') {
      yours.current?.scrollIntoView({ behavior });
      focus(
        p.decided.length
          ? `practice-yours-${p.decided.length}`
          : 'practice-yours',
      );
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
    return () => cancelAnimationFrame(frame);
  }, [p.phase, p.saved, p.run, p.decided.length, reduced]);

  const i = p.current;
  const answered = isAnswered(p.questions[i].rule, p.answers[i]);
  // As Check in's Save: it stays filled, and pressed early it says why and goes to what's missing.
  const missing =
    early === i && !answered && !needsShot(p.questions[i].rule, p.answers[i])
      ? p.questions[i].rule.kind === 'number'
        ? 'Enter a number to save.'
        : 'Choose Yes or No.'
      : null;
  const action =
    p.phase === 'answer' ? (
      <>
        {missing && (
          <output className="block text-center text-nx-2 text-nx-ink-2">
            {missing}
          </output>
        )}
        <Button
          variant="primary"
          size="lg"
          full
          onClick={() => {
            if (answered) return p.save();
            setEarly(i);
            question.current
              ?.querySelector<HTMLElement>(
                needsShot(p.questions[i].rule, p.answers[i])
                  ? '.nx-proofs button:last-child'
                  : 'input',
              )
              ?.focus();
          }}
        >
          Save
        </Button>
      </>
    ) : p.phase === 'review' ? (
      // The next step's title, just under the review, says what comes next.
      <Button
        variant="primary"
        size="lg"
        full
        iconEnd={ArrowRight}
        onClick={p.toYours}
      >
        Next
      </Button>
    ) : p.phase === 'yours' ? (
      // As on Review: Dispute and Approve side by side, Approve the filled one.
      <>
        <Button
          variant="secondary"
          size="lg"
          className="flex-1 px-3"
          onClick={() => {
            setDisputed(reviewing ?? null);
            setDisputing(true);
          }}
        >
          Dispute
        </Button>
        <Button
          variant="primary"
          size="lg"
          icon={Check}
          className="flex-1 px-3"
          onClick={() => p.decide({ decision: 'approve' })}
        >
          Approve
        </Button>
      </>
    ) : (
      <>
        <Button
          variant="primary"
          size="lg"
          full
          icon={joined ? ArrowRight : UserPlus}
          onClick={() => (live ? navigate(null) : navigate('invite'))}
        >
          {joined ? 'Back to your challenge' : `Invite ${partner} for real`}
        </Button>
        <Button variant="quiet" icon={RotateCcw} onClick={p.restart}>
          Practice again
        </Button>
      </>
    );

  return (
    // The marker sits in the top bar beside Back, so each step fits under it.
    <PlainFrame back={{ to: 'setup' }} aside={<PracticeBanner />}>
      <div className="flex flex-col gap-6">
        {/* The marker says what this is; the title is for screen readers. */}
        <h1 className="sr-only">Practice day</h1>

        <ol className="flex flex-col gap-4" key={p.run}>
          <Step
            state={state('answer')}
            title="Answer three check-ins"
            // How many are saved, as Check in shows it; each answer is on Jordan's review next.
            aside={
              p.phase === 'answer' && (
                <ProgressBar
                  value={p.saved}
                  max={p.questions.length}
                  segments
                  size="sm"
                  label={`${p.saved} of ${p.questions.length} saved`}
                  className="w-16 shrink-0"
                />
              )
            }
          >
            {p.phase === 'answer' && (
              <div ref={question} className="scroll-mb-40">
                <GlassCard key={i} className="nx-enter">
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
            title={`${Partner} reviews them`}
            anchor={review}
            headingId="practice-review"
          >
            {/* Only the step under way is open; a finished one keeps its title and check. */}
            {p.phase === 'review' && (
              <div className="nx-enter">
                <PartnerReview p={p} />
              </div>
            )}
          </Step>

          <Step
            state={state('yours')}
            title={`Review ${partner}’s answers`}
            anchor={yours}
            headingId="practice-yours"
          >
            {p.phase === 'yours' && (
              <div className="flex flex-col gap-2">
                {p.decided.map((d, n) => (
                  <div
                    key={toReview[n].rule.id}
                    className="nx-enter flex items-center gap-3 rounded-nx border border-nx-line bg-nx-surface-2 px-4 py-3"
                  >
                    <span className="min-w-0 flex-1 text-nx-body text-nx-ink">
                      {shortTitle(toReview[n].rule)}
                      <span className="text-nx-ink-2">
                        {' · '}
                        {partnerAnswerText(
                          toReview[n].rule,
                          toReview[n].answer,
                        )}
                      </span>
                    </span>
                    <StatusPill
                      className="shrink-0"
                      status={d.decision === 'approve' ? 'done' : 'disputed'}
                      label={d.decision === 'approve' ? 'Approved' : 'Disputed'}
                    />
                  </div>
                ))}
                {reviewing && (
                  <GlassCard
                    key={reviewing.rule.id}
                    pad="lg"
                    className={cn('nx-enter', p.decided.length && 'mt-1')}
                  >
                    <AnswerToReview
                      item={reviewing}
                      headingId={
                        p.decided.length
                          ? `practice-yours-${p.decided.length}`
                          : undefined
                      }
                    />
                  </GlassCard>
                )}
              </div>
            )}
          </Step>

          <Step
            state={state('gift')}
            title="What a point costs"
            anchor={gift}
            headingId="practice-gift"
            last
          >
            {p.phase === 'gift' && (
              <div className="nx-enter flex flex-col gap-4">
                <MissLine p={p} />
                <GiftSteps p={p} onHow={() => setHow(true)} />
              </div>
            )}
          </Step>
        </ol>

        <ActionBar
          className={cn(p.phase === 'yours' && 'flex-row items-stretch')}
        >
          {action}
        </ActionBar>
      </div>
      <HowPointsSheet open={how} onOpenChange={setHow} />
      <ReasonSheet
        key={`practice-dispute:${p.run}:${disputed?.rule.id}`}
        open={disputing}
        onOpenChange={setDisputing}
        title={`Dispute ${partner}’s answer`}
        description={`No point unless ${partner} concedes it.`}
        label="Your reason"
        placeholder="What looks off to you?"
        submit="Dispute"
        missing={`Write a reason so ${partner} knows what to look at.`}
        onSubmit={(reason) => {
          setDisputing(false);
          p.decide({ decision: 'dispute', reason });
        }}
      >
        {disputed && (
          <div className="rounded-nx bg-nx-sunken px-4 py-3">
            <p className="text-nx-body font-semibold">{disputed.rule.title}</p>
            <p className="text-nx-2 text-nx-ink-2">
              {Partner} said {partnerAnswerText(disputed.rule, disputed.answer)}
            </p>
          </div>
        )}
      </ReasonSheet>
    </PlainFrame>
  );
}
