'use client';
import { useEffect, useState } from 'react';
import type { Proof, Rule, World } from '@/lib/next/model';
import {
  formatAnswer,
  formatMoney,
  giftTotal,
  meetsTarget,
  shift,
} from '@/lib/next/selectors';
import { screenTimeShot } from '@/lib/next/shots';
import { useReducedMotion } from '@/components/next/ui';
import { useWorld } from '@/components/next/world';

/**
 * The practice day, shared by both versions: three sample check-ins answered in local state, a
 * pretend partner who approves one and disputes one, and the miss that adds a step to the gift.
 * Nothing here touches the sample world: practice is never saved.
 */

export type Answer = {
  done: boolean | null;
  value: number | null;
  proofs: Proof[];
};

export type Phase = 'answer' | 'review' | 'gift';
export const PHASES: { id: Phase; label: string }[] = [
  { id: 'answer', label: 'Answer' },
  { id: 'review', label: 'Review' },
  { id: 'gift', label: 'Gift' },
];

/** "Social media and games" from "Social media and games, 60 min or less". */
export const shortTitle = (rule: Pick<Rule, 'title'>) =>
  rule.title.split(', ')[0];

/** The pretend partner's dispute says the screenshot shows 1h 12m, so the sample screenshot does. */
const SHOT_MINUTES = 72;

export function sampleShot(w: World): Proof {
  return {
    id: 'practice-screen-time',
    src: screenTimeShot(SHOT_MINUTES, shift(w.today, -1)),
    alt: 'Screen Time screenshot: 1h 12m of social media and games',
  };
}

const firstAnswers = (w: World): Answer[] =>
  w.practice.questions.map((q) => ({
    done: q.sample.done ?? null,
    value: q.sample.value ?? null,
    proofs: [],
  }));

/** A Yes, or a number that meets its target. */
export function isYes(rule: Rule, a: Answer) {
  if (rule.kind === 'number')
    return (
      a.value !== null && !!rule.target && meetsTarget(rule.target, a.value)
    );
  return a.done === true;
}

/** Answered, with the screenshot a Yes needs. */
export const needsShot = (rule: Rule, a: Answer) =>
  rule.proof === 'required' && isYes(rule, a) && a.proofs.length === 0;

export const isAnswered = (rule: Rule, a: Answer) =>
  (rule.kind === 'number' ? a.value !== null : a.done !== null) &&
  !needsShot(rule, a);

/** "Yes", "No", "45 min". */
export const answerText = (rule: Rule, a: Answer) =>
  formatAnswer(rule, {
    done: isYes(rule, a),
    value: a.value ?? undefined,
  });

/** What the answers lead to: the partner's review of each Yes, and a point for each miss. */
export function outcomes(w: World, answers: Answer[]) {
  const { questions, partnerReview, miss } = w.practice;
  const { step, cap } = w.challenge;
  const reviewed: {
    rule: Rule;
    answer: Answer;
    decision: 'approve' | 'dispute';
    comment?: string;
  }[] = [];
  const misses: { rule: Rule; answer: Answer }[] = [];
  questions.forEach((q, i) => {
    const a = answers[i];
    if (isYes(q.rule, a)) {
      const says = partnerReview.find((r) => r.ruleId === q.rule.id);
      reviewed.push({
        rule: q.rule,
        answer: a,
        decision: says?.decision ?? 'approve',
        comment: says?.comment,
      });
    } else misses.push({ rule: q.rule, answer: a });
  });
  const costOf = (n: number) =>
    giftTotal(n, step, cap) - giftTotal(n - 1, step, cap);
  return {
    reviewed,
    misses,
    /** What each miss added: the nth costs n steps. */
    costs: misses.map((_, i) => costOf(i + 1)),
    total: giftTotal(misses.length, step, cap),
    nextCost: costOf(misses.length + 1),
    costOf,
    step,
    /** The scripted miss, to show what a No would cost when every answer was a Yes. */
    example: questions.find((q) => q.rule.id === miss.ruleId)?.rule ?? null,
  };
}

export type Outcomes = ReturnType<typeof outcomes>;

/** "See what the miss costs", worded for how many misses there are. */
export const costButton = (misses: number) =>
  misses === 0
    ? 'See what a miss costs'
    : misses === 1
      ? 'See what the miss costs'
      : 'See what the misses cost';

/** "The first point costs $1, the second $2, and so on." */
export const ladderLine = (step: number) =>
  `The first point costs ${formatMoney(step)}, the second ${formatMoney(step * 2)}, and so on.`;

/**
 * The practice run: answers, how many are saved, the phase, and how many of the partner's
 * decisions have appeared (one every 0.8 s, all at once under reduced motion). Moving on never
 * waits for them.
 */
export function usePractice() {
  const world = useWorld();
  const reduced = useReducedMotion();
  const questions = world.practice.questions;
  const [answers, setAnswers] = useState<Answer[]>(() => firstAnswers(world));
  const [saved, setSaved] = useState(0);
  const [phase, setPhase] = useState<Phase>('answer');
  const [shown, setShown] = useState(0);
  const [run, setRun] = useState(0);
  const result = outcomes(world, answers);
  const count = result.reviewed.length;
  const reviewing = phase === 'review';

  useEffect(() => {
    if (!reviewing || reduced) return;
    const timers = Array.from({ length: count }, (_, i) =>
      setTimeout(() => setShown((n) => Math.max(n, i + 1)), 700 + i * 800),
    );
    return () => timers.forEach(clearTimeout);
  }, [reviewing, reduced, count]);

  const revealed = phase === 'answer' ? 0 : reduced ? count : shown;

  return {
    world,
    questions,
    answers,
    saved,
    phase,
    run,
    result,
    /** The partner's decisions on screen so far. */
    revealed,
    reviewDone: revealed >= count,
    /** The question being answered (while answering). */
    current: Math.min(saved, questions.length - 1),
    setAnswer: (i: number, patch: Partial<Answer>) =>
      setAnswers((list) =>
        list.map((a, j) => (j === i ? { ...a, ...patch } : a)),
      ),
    /** Saves the current answer and moves to the next question, or to the review after the last. */
    save: () => {
      const i = Math.min(saved, questions.length - 1);
      if (!isAnswered(questions[i].rule, answers[i])) return;
      if (i + 1 >= questions.length) {
        setShown(0);
        setPhase('review');
      }
      setSaved(i + 1);
    },
    /** On to the gift; any decisions still to appear show at once. */
    toGift: () => {
      setShown(count);
      setPhase('gift');
    },
    restart: () => {
      setAnswers(firstAnswers(world));
      setSaved(0);
      setShown(0);
      setPhase('answer');
      setRun((r) => r + 1);
    },
  };
}

export type Practice = ReturnType<typeof usePractice>;
