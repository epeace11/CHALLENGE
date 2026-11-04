'use client';
import { useEffect, useState } from 'react';
import type { PracticeScript, Proof, Rule, World } from '@/lib/next/model';
import {
  formatAnswer,
  formatMoney,
  giftTotal,
  meetsTarget,
  shift,
} from '@/lib/next/selectors';
import { shotKind } from '@/lib/next/practice';
import { screenTimeShot, stepsShot } from '@/lib/next/shots';
import { useReducedMotion } from '@/components/next/ui';
import { useWorld } from '@/components/next/world';

/**
 * The practice day: three sample check-ins answered in local state, a pretend partner who approves
 * one and disputes one, the partner's answers for you to review, and the miss that adds a step to
 * the gift. Nothing here touches the sample world: practice is never saved.
 */

export type Answer = {
  done: boolean | null;
  value: number | null;
  proofs: Proof[];
};

export type Phase = 'answer' | 'review' | 'yours' | 'gift';

/** What you did with one of the partner's answers, and your reason for a dispute. */
export type Decision = { decision: 'approve' | 'dispute'; reason?: string };
/** A name at the start of a sentence: "Your partner reviews them" while the partner hasn't joined. */
export const capital = (name: string) =>
  name.charAt(0).toUpperCase() + name.slice(1);

/** "Social media and games" from "Social media and games, 60 min or less". */
export const shortTitle = (rule: Pick<Rule, 'title'>) =>
  rule.title.split(', ')[0];

/**
 * A practice screenshot for a number rule, showing `value` yesterday: screen time (social 65% and
 * games, plus some productivity) or a step count. The pretend partner's dispute quotes what it
 * shows (practiceFor in lib/next/practice.ts). Null for a rule practice can't draw.
 */
export function shotOf(w: World, rule: Rule, value: number): Proof | null {
  const day = shift(w.today, -1);
  const id = `practice-${rule.id}-${value}`;
  if (shotKind(rule) === 'steps')
    return {
      id,
      src: stepsShot(value, day),
      alt: `Step count screenshot, ${value.toLocaleString('en-US')} steps`,
    };
  if (shotKind(rule) === 'screen') {
    const social = Math.round(value * 0.65);
    return {
      id,
      src: screenTimeShot(value, day),
      alt: `Screen Time screenshot: social ${social}m and games ${value - social}m`,
    };
  }
  return null;
}

/** The screenshot that goes with your sample answer to question `i`, when it has one. */
export const sampleShot = (w: World, i: number): Proof[] => {
  const q = w.practice.questions[i];
  const shot = q.shot ?? q.sample.value;
  const proof = shot === undefined ? null : shotOf(w, q.rule, shot);
  return proof ? [proof] : [];
};

/** The sample answers, with the screenshot a required one needs, so every sample can be saved as it is. */
const firstAnswers = (w: World): Answer[] =>
  w.practice.questions.map((q, i) => ({
    done: q.sample.done ?? null,
    value: q.sample.value ?? null,
    proofs: q.rule.proof === 'required' ? sampleShot(w, i) : [],
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

/**
 * What the screenshot of one of the partner's answers shows instead ("8,412 steps"), when it
 * doesn't back the answer; null when it does or there is none.
 */
export function shotSays(item: PracticeScript['partnerAnswers'][number]) {
  if (item.shot === undefined || item.shot === item.answer.value) return null;
  return partnerAnswerText(item.rule, { value: item.shot });
}

/** "10,200 steps", "Yes": one of the partner's answers to review. */
export const partnerAnswerText = (
  rule: Rule,
  answer: { done?: boolean; value?: number },
) => formatAnswer(rule, { done: answer.done ?? false, value: answer.value });

/** "The first point costs $1, the second $2, and so on." */
export const ladderLine = (step: number) =>
  `The first point costs ${formatMoney(step)}, the second ${formatMoney(step * 2)}, and so on.`;

/**
 * The practice run: answers, how many are saved, the phase, how many of the partner's decisions
 * have appeared (one every 0.8 s, all at once under reduced motion; moving on never waits for
 * them), and what you did with the partner's answers.
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
  const [decided, setDecided] = useState<Decision[]>([]);
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
  const current = Math.min(saved, questions.length - 1);

  /** Saves the current answer and moves to the next question, or to the review after the last. */
  const save = (a: Answer) => {
    if (!isAnswered(questions[current].rule, a)) return;
    if (current + 1 >= questions.length) {
      setShown(0);
      setPhase('review');
    }
    setSaved(current + 1);
  };

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
    current,
    setAnswer: (i: number, patch: Partial<Answer>) =>
      setAnswers((list) =>
        list.map((a, j) => (j === i ? { ...a, ...patch } : a)),
      ),
    /** Yes or No. A plain Yes saves at once, as in Check in; No waits for Save. */
    choose: (i: number, done: boolean) => {
      const a = { ...answers[i], done };
      setAnswers((list) => list.map((x, j) => (j === i ? a : x)));
      if (done && i === current) save(a);
    },
    save: () => save(answers[current]),
    /** On to reviewing the partner's answers; any of their decisions still to appear show at once. */
    toYours: () => {
      setShown(count);
      setPhase('yours');
    },
    /** What you did with each of the partner's answers so far, in order. */
    decided,
    /**
     * Approve or dispute the partner's next answer; after the last, on to the gift, unless an answer
     * its screenshot doesn't back was approved: that stays on screen to say so, until Next.
     */
    decide: (d: Decision) => {
      const next = [...decided, d];
      setDecided(next);
      const theirs = world.practice.partnerAnswers;
      const missed = next.some(
        (x, n) => x.decision === 'approve' && !!shotSays(theirs[n]),
      );
      if (next.length >= theirs.length && !missed) setPhase('gift');
    },
    /** On to the gift, after reading what an approved answer's screenshot said. */
    toGift: () => setPhase('gift'),
    restart: () => {
      setAnswers(firstAnswers(world));
      setSaved(0);
      setShown(0);
      setDecided([]);
      setPhase('answer');
      setRun((r) => r + 1);
    },
  };
}

export type Practice = ReturnType<typeof usePractice>;
