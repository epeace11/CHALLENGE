'use client';
import type { CSSProperties } from 'react';
import { ChevronRight, FlaskConical } from 'lucide-react';
import type { Rule } from '@/lib/next/model';
import { formatDeadline, formatMoney } from '@/lib/next/selectors';
import {
  Avatar,
  Button,
  CountUp,
  NumberField,
  ProgressBar,
  ProofStrip,
  Sheet,
  StatusPill,
  YesNo,
} from '@/components/next/ui';
import { useWorld } from '@/components/next/world';
import { cn } from '@/lib/utils';
import {
  PHASES,
  answerText,
  ladderLine,
  needsShot,
  sampleShot,
  shortTitle,
  type Practice,
} from './script';
import styles from './practice.module.css';

/** The marker on every practice screen. */
export function PracticeBanner({ className }: { className?: string }) {
  return (
    <p
      role="note"
      className={cn(
        'flex items-center gap-3 rounded-nx border-[1.5px] border-dashed border-nx-accent-line bg-nx-accent-soft px-4 py-3 text-nx-2 font-semibold text-nx-accent',
        className,
      )}
    >
      <FlaskConical size={20} className="shrink-0" aria-hidden="true" />
      Practice. Nothing here is saved.
    </p>
  );
}

/** Answer, Review, Gift: where the run is. Each bar fills as its part goes. */
export function PhaseBar({
  p,
  className,
}: {
  p: Practice;
  className?: string;
}) {
  const at = PHASES.findIndex((x) => x.id === p.phase);
  const n = p.questions.length,
    reviewed = p.result.reviewed.length;
  const fill = (i: number) =>
    i < at
      ? 1
      : i > at
        ? 0
        : p.phase === 'answer'
          ? p.saved / n
          : p.phase === 'review'
            ? reviewed
              ? p.revealed / reviewed
              : 1
            : 1;
  return (
    <ol className={cn('grid grid-cols-3 gap-2', className)}>
      {PHASES.map((phase, i) => (
        <li
          key={phase.id}
          className="flex flex-col gap-1.5"
          aria-current={i === at ? 'step' : undefined}
        >
          <ProgressBar
            value={fill(i)}
            max={1}
            size="sm"
            label={`${phase.label}: ${i < at ? 'done' : i === at ? 'now' : 'next'}`}
          />
          <span
            className={cn(
              'text-nx-min font-semibold',
              i === at ? 'text-nx-accent' : 'text-nx-ink-2',
            )}
          >
            {phase.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

const unitLabel = (rule: Rule) => {
  const unit = rule.target?.unit ?? '';
  if (unit === 'min') return 'Minutes';
  return unit ? unit[0].toUpperCase() + unit.slice(1) : 'Number';
};

/** One sample check-in: the question, what counts, and the answer (Yes or No, or a number with its screenshot). */
export function Question({
  p,
  index,
  headingId,
}: {
  p: Practice;
  index: number;
  headingId?: string;
}) {
  const world = useWorld();
  const rule = p.questions[index].rule;
  const a = p.answers[index];
  const set = (patch: Parameters<Practice['setAnswer']>[1]) =>
    p.setAnswer(index, patch);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <p className="nx-kicker">{shortTitle(rule)}</p>
        <h2
          id={headingId}
          tabIndex={headingId ? -1 : undefined}
          className="font-nx-serif text-nx-h2"
        >
          {rule.question}
        </h2>
        <p className="text-nx-2 text-nx-ink-2">{rule.description}</p>
      </div>
      {rule.kind === 'number' ? (
        <>
          <NumberField
            label={unitLabel(rule)}
            value={a.value}
            onChange={(value) => set({ value })}
            target={rule.target}
            step={5}
          />
          {rule.proof !== 'none' && (
            <div className="flex flex-col gap-2">
              <p className="text-nx-2 font-semibold text-nx-ink">Screenshot</p>
              <ProofStrip
                proofs={a.proofs}
                onAdd={
                  a.proofs.length
                    ? undefined
                    : () => set({ proofs: [sampleShot(world)] })
                }
                onRemove={() => set({ proofs: [] })}
              />
              {needsShot(rule, a) && (
                <p className="text-nx-2 text-nx-ink-2">
                  Add the screenshot to save.
                </p>
              )}
            </div>
          )}
        </>
      ) : (
        <YesNo
          label={rule.question}
          value={a.done}
          onChange={(done) => set({ done })}
        />
      )}
    </div>
  );
}

/** The pretend partner with a dashed ring, so it never reads as the real one. */
export function PretendPartner({ detail }: { detail: string }) {
  const world = useWorld();
  return (
    <div className="flex items-center gap-3">
      <span className="rounded-full border-2 border-dashed border-nx-accent-line p-0.5">
        <Avatar person={world.partner} decorative />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-nx-body font-semibold">
          {world.partner.name}
          <span className="rounded-full bg-nx-sunken px-2.5 py-0.5 text-nx-min text-nx-ink-2">
            Pretend
          </span>
        </p>
        <p className="text-nx-2 text-nx-ink-2" aria-live="polite">
          {detail}
        </p>
      </div>
    </div>
  );
}

/** The pretend partner's review: each Yes turns Approved or Disputed as it comes in; each miss is already a point. */
export function PartnerReview({ p }: { p: Practice }) {
  const partner = p.world.partner.name;
  const { reviewed, misses } = p.result;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <PretendPartner
            detail={
              !reviewed.length
                ? 'Nothing to review'
                : p.reviewDone
                  ? 'Reviewed your answers'
                  : 'Reviewing your answers'
            }
          />
        </div>
        {!p.reviewDone && (
          <span className="nx-spinner text-nx-accent" aria-hidden="true" />
        )}
      </div>
      <ul className="flex flex-col gap-3">
        {reviewed.map((r, i) => {
          const shown = i < p.revealed;
          const approved = r.decision === 'approve';
          return (
            <li
              key={r.rule.id}
              className="rounded-nx border border-nx-line bg-nx-surface-2 p-4"
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-nx-body font-semibold text-nx-ink">
                    {shortTitle(r.rule)}
                  </p>
                  <p className="text-nx-2 text-nx-ink-2">
                    You said {answerText(r.rule, r.answer)}
                  </p>
                </div>
                <span
                  key={shown ? 'decided' : 'waiting'}
                  className={cn('shrink-0', shown && 'nx-enter')}
                >
                  <StatusPill
                    status={!shown ? 'review' : approved ? 'done' : 'disputed'}
                    label={
                      !shown
                        ? `Waiting for ${partner}`
                        : approved
                          ? 'Approved'
                          : 'Disputed'
                    }
                  />
                </span>
              </div>
              {shown && !approved && (
                <div className="nx-enter mt-3 flex flex-col gap-2">
                  {r.comment && (
                    <p className="rounded-nx-sm bg-nx-sunken px-3 py-2 text-nx-2 text-nx-ink">
                      {partner}: “{r.comment}”
                    </p>
                  )}
                  <p className="text-nx-2 text-nx-ink-2">
                    It costs nothing while it is disputed. Accept it and it
                    becomes a point, or reply so {partner} can take it back.
                  </p>
                </div>
              )}
            </li>
          );
        })}
        {misses.map((m) => (
          <li
            key={m.rule.id}
            className="rounded-nx border border-nx-line bg-nx-surface-2 p-4"
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-nx-body font-semibold text-nx-ink">
                  {shortTitle(m.rule)}
                </p>
                <p className="text-nx-2 text-nx-ink-2">
                  You said {answerText(m.rule, m.answer)}
                </p>
              </div>
              <StatusPill status="missed" className="shrink-0" />
            </div>
            <p className="mt-2 text-nx-2 text-nx-ink-2">
              A miss needs no review. It is a point right away.
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** What the misses did, above the gift. The amounts themselves are on the gift, one tap from how points work. */
export function MissLine({
  p,
  heading = true,
  headingId,
}: {
  p: Practice;
  /** Off where the page already titles this part. */
  heading?: boolean;
  /** Lets the page move focus to the heading when this step appears. */
  headingId?: string;
}) {
  const r = p.result,
    partner = p.world.partner.name;
  const sets = `Points set the gift you buy ${partner}.`;
  const [title, line] =
    r.misses.length === 1
      ? [
          'Your miss is a point',
          `${shortTitle(r.misses[0].rule)}: you said ${answerText(r.misses[0].rule, r.misses[0].answer)}. ${sets}`,
        ]
      : r.misses.length > 1
        ? [
            'Your misses are points',
            `${sets} Each one costs a step more than the last.`,
          ]
        : [
            'No misses, no points',
            r.example
              ? `A No to “${r.example.question}” would be a point. ${sets}`
              : `A miss would be a point. ${sets}`,
          ];
  return (
    <div className="flex flex-col gap-2">
      {heading && (
        <h2
          id={headingId}
          tabIndex={headingId ? -1 : undefined}
          className="font-nx-serif text-nx-h2"
        >
          {title}
        </h2>
      )}
      <p className="text-nx-body text-nx-ink-2">{line}</p>
    </div>
  );
}

/** The gift so far and its steps, as one button that opens how points work. */
export function GiftSteps({
  p,
  onHow,
  className,
}: {
  p: Practice;
  onHow: () => void;
  className?: string;
}) {
  const r = p.result,
    partner = p.world.partner.name;
  const count = Math.max(5, r.misses.length + 2);
  return (
    <button
      type="button"
      className={cn('nx-card nx-tappable flex-col gap-5 p-5 sm:p-6', className)}
      onClick={onHow}
    >
      <span className="flex flex-col gap-1.5">
        <span className="text-nx-2 text-nx-ink-2">Gift you buy {partner}</span>
        <span className="font-nx-serif text-nx-num-lg leading-none text-nx-accent">
          <CountUp value={r.total} format={formatMoney} />
        </span>
      </span>
      <span
        className="grid w-full items-end gap-2"
        style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
        aria-hidden="true"
      >
        {Array.from({ length: count }, (_, i) => (
          <span key={i} className="flex flex-col items-center gap-1.5">
            <span className={styles.step} style={{ height: 16 + i * 14 }}>
              <span
                className={styles.fill}
                data-on={i < r.misses.length || undefined}
                style={{ ['--nx-i' as string]: i } as CSSProperties}
              />
            </span>
            <span
              className={cn(
                'text-nx-min',
                i < r.misses.length
                  ? 'font-semibold text-nx-ink'
                  : 'text-nx-ink-2',
              )}
            >
              {formatMoney(r.costOf(i + 1))}
            </span>
          </span>
        ))}
      </span>
      <span className="flex w-full flex-col gap-3 border-t border-nx-line pt-4">
        <span className="text-nx-2 text-nx-ink-2">
          {r.misses.length
            ? `Your next miss would add ${formatMoney(r.nextCost)}.`
            : ladderLine(r.step)}
        </span>
        <span className="inline-flex items-center gap-1 text-nx-body font-semibold text-nx-accent">
          How points work
          <ChevronRight size={20} aria-hidden="true" />
        </span>
      </span>
    </button>
  );
}

/** "How points and gifts work", one tap from the gift. */
export function HowPointsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const world = useWorld();
  const c = world.challenge,
    partner = world.partner.name;
  const lines = [
    `Each miss is a point: a No, a number off its target, or a check-in not logged by ${formatDeadline(c.deadline)}.`,
    ladderLine(c.step),
    'A disputed answer costs nothing until it is settled.',
    `${partner} can forgive a point. A forgiven point costs nothing.`,
    c.cap !== null ? `A gift never goes over ${formatMoney(c.cap)}.` : null,
    'When the challenge ends, each of you buys the other a gift worth your own points.',
  ].filter(Boolean) as string[];
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="How points and gifts work"
      footer={<Button onClick={() => onOpenChange(false)}>Close</Button>}
    >
      <ul className="flex flex-col divide-y divide-nx-line">
        {lines.map((line) => (
          <li key={line} className="py-3 text-nx-body text-nx-ink">
            {line}
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
