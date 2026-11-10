'use client';
import type { CSSProperties } from 'react';
import { ChevronRight, FlaskConical } from 'lucide-react';
import type { PracticeScript, Rule } from '@/lib/next/model';
import { formatDeadline, formatMoney } from '@/lib/next/selectors';
import {
  Button,
  CountUp,
  NumberField,
  ProofStrip,
  Sheet,
  StatusPill,
  YesNo,
} from '@/components/next/ui';
import { useWorld } from '@/components/next/world';
import { cn } from '@/lib/utils';
import {
  answerText,
  capital,
  ladderLine,
  needsShot,
  partnerAnswerText,
  shotOf,
  sampleShot,
  shortTitle,
  type Practice,
} from './script';
import styles from './practice.module.css';

/** The marker on every practice screen, in the top bar beside Back (two lines on the narrowest phones). */
export function PracticeBanner({ className }: { className?: string }) {
  return (
    <p
      role="note"
      className={cn(
        'flex min-h-11 items-center gap-2 rounded-full border-[1.5px] border-dashed border-nx-accent-line bg-nx-accent-soft px-3.5 py-1.5 text-nx-2 leading-tight font-semibold text-nx-accent',
        className,
      )}
    >
      <FlaskConical size={18} className="shrink-0" aria-hidden="true" />
      Practice. Nothing counts.
    </p>
  );
}

/** How far − and + move a sample number. */
const stepOf = (rule: Rule) =>
  rule.target?.unit === 'steps' ? 500 : rule.target?.unit === 'min' ? 5 : 1;

const unitLabel = (rule: Rule) => {
  const unit = rule.target?.unit ?? '';
  if (unit === 'min') return 'Minutes';
  return unit ? unit[0].toUpperCase() + unit.slice(1) : 'Number';
};

/** One sample check-in, as on Check in: the question and the answer (Yes or No, or a number with its screenshot). */
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
      {/* The question is enough: the rule's description is on Rules and help, as on Check in. */}
      <h2
        id={headingId}
        tabIndex={headingId ? -1 : undefined}
        className="font-nx-serif text-nx-h2"
      >
        {rule.question}
      </h2>
      {rule.kind === 'number' ? (
        // From 640px the screenshot sits beside the number, as in Check in.
        <div className="flex flex-col gap-5 sm:grid sm:grid-cols-2 sm:gap-6">
          <NumberField
            label={unitLabel(rule)}
            value={a.value}
            onChange={(value) => set({ value })}
            target={rule.target}
            step={stepOf(rule)}
          />
          {rule.proof !== 'none' && (
            <div className="flex flex-col gap-2">
              {/* As in Check in: once a screenshot is added, the thumbnail says so. */}
              {!a.proofs.length && (
                <p className="text-nx-2 font-semibold text-nx-ink">
                  Screenshot
                </p>
              )}
              <ProofStrip
                proofs={a.proofs}
                onAdd={
                  a.proofs.length
                    ? undefined
                    : () => set({ proofs: sampleShot(world, index) })
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
        </div>
      ) : (
        <YesNo
          label={rule.question}
          value={a.done}
          onChange={(done) => set({ done })}
          onTap={(done) => p.choose(index, done)}
        />
      )}
    </div>
  );
}

/**
 * One of the pretend partner's answers, for you to approve or dispute with the pinned buttons: the
 * rule, the answer, and its screenshot (which, for a number, doesn't match).
 */
export function AnswerToReview({
  item,
  headingId,
}: {
  item: PracticeScript['partnerAnswers'][number];
  /** Focus moves here when it follows a decision; the first one's step title takes focus instead. */
  headingId?: string;
}) {
  const world = useWorld();
  const partner = world.partner.name;
  const shot =
    item.shot === undefined ? null : shotOf(world, item.rule, item.shot);
  return (
    // From 640px the screenshot sits beside the answer.
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="flex flex-col gap-1">
        <h3
          id={headingId}
          tabIndex={headingId ? -1 : undefined}
          className="font-nx-sans text-nx-body font-semibold text-nx-ink outline-none"
        >
          {item.rule.title}
        </h3>
        <p className="text-nx-2 text-nx-ink-2">{capital(partner)} said</p>
        <p className="font-nx-serif text-nx-num leading-tight text-nx-ink">
          {partnerAnswerText(item.rule, item.answer)}
        </p>
      </div>
      {shot && <ProofStrip proofs={[shot]} />}
    </div>
  );
}

/**
 * The pretend partner's review: each Yes turns Approved or Disputed as it comes in; each miss is
 * already a point. The step's title says who reviews and the banner that it is practice, so the
 * cards follow it with no header of their own.
 */
export function PartnerReview({ p }: { p: Practice }) {
  const partner = p.world.partner.name;
  const { reviewed, misses } = p.result;
  return (
    <div className="flex flex-col gap-4">
      {/* Screen readers still hear how the review is going. */}
      <p className="sr-only" aria-live="polite">
        {!reviewed.length
          ? 'Nothing to review'
          : p.reviewDone
            ? `${capital(partner)} reviewed your answers`
            : `${capital(partner)} is reviewing your answers`}
      </p>
      {/* From 640px the short cards sit two to a row and a dispute, with its comment, takes the
          row under them. */}
      <ul className="flex flex-col gap-3 sm:grid sm:grid-cols-2">
        {reviewed.map((r, i) => {
          const shown = i < p.revealed;
          const approved = r.decision === 'approve';
          return (
            <li
              key={r.rule.id}
              className={cn(
                'rounded-nx border border-nx-line bg-nx-surface-2 p-4',
                !approved && 'sm:order-last sm:col-span-2',
              )}
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
                      {capital(partner)}: “{r.comment}”
                    </p>
                  )}
                  <p className="text-nx-2 text-nx-ink-2">
                    No point unless you concede it.
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
              A miss is a point right away.
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * What the misses did, above the gift. Each miss is on its card just above and the gift says whom
 * it is for, so this says only that misses are points; the amounts are on the gift, one tap from
 * how points work.
 */
export function MissLine({ p }: { p: Practice }) {
  const r = p.result;
  const line =
    r.misses.length === 1
      ? 'Your miss is a point.'
      : r.misses.length > 1
        ? `Your misses are points. Each point costs ${formatMoney(r.step)} more than the one before.`
        : r.example
          ? `No misses, no points. A No to “${r.example.question}” would be a point.`
          : 'No misses, no points.';
  return <p className="text-nx-body text-nx-ink-2">{line}</p>;
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
      {/* From 640px the amount sits beside its steps. */}
      <span className="flex w-full flex-col gap-5 sm:flex-row sm:items-end sm:gap-8">
        <span className="flex flex-col gap-1.5 sm:shrink-0">
          <span className="text-nx-2 text-nx-ink-2">
            The gift you give {partner}
          </span>
          <span className="font-nx-serif text-nx-num-lg leading-none text-nx-accent">
            <CountUp value={r.total} format={formatMoney} />
          </span>
        </span>
        <span
          className="grid w-full items-end gap-2 sm:flex-1"
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
      </span>
      <span className="flex w-full flex-col gap-3 border-t border-nx-line pt-4">
        <span className="text-nx-2 text-nx-ink-2">
          {`Your ${r.misses.length ? 'next' : 'first'} miss would add ${formatMoney(r.nextCost)}.`}
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
    `Your points set the gift you give ${partner}, and ${partner}’s points set the gift you get. You give them when the challenge ends.`,
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
