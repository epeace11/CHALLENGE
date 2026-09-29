'use client';
import { useEffect, useState } from 'react';
import type { Rule } from '@/lib/next/model';
import { useNav } from '@/components/next/nav';
import { useWorld } from '@/components/next/world';
import { useToast } from '@/components/next/ui';
import {
  DAY_PRESETS,
  DRAFT_MS,
  PHRASE_MS,
  presetOf,
  questionFor,
  sameDays,
  type Answer,
} from './draft';

export type Stage = 'write' | 'drafting' | 'check';

/** What the edit sheet holds while a drafted rule is being changed. */
export type EditDraft = {
  ruleId: string;
  title: string;
  who: string;
  preset: string;
  target: number | null;
  proof: Rule['proof'];
};

/**
 * Everything Say your rules does, for both versions: the sentence, the pretend drafting (about
 * 1.5 s, lighting up each part of the sentence), the drafted rules with the one question, editing,
 * removing (with Undo), Start over (with Undo) and Use these rules. All of it is local: nothing
 * reaches the sample world until setup.
 */
export function useSay() {
  const world = useWorld();
  const draft = world.sayRules;
  const { navigate } = useNav();
  const toast = useToast();

  const [stage, setStage] = useState<Stage>('write');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  /** How many parts of the sentence are lit while drafting (0–3). */
  const [lit, setLit] = useState(0);
  const [rules, setRules] = useState<Rule[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  /** The rule whose question was skipped when Use these rules was tapped. */
  const [missing, setMissing] = useState<string | null>(null);
  /** The edit sheet: open or closing, the rule as it was when opened, and the changes so far. */
  const [edit, setEdit] = useState<{
    open: boolean;
    rule: Rule | null;
    value: EditDraft | null;
  }>({ open: false, rule: null, value: null });

  // The pretend drafting: light each part of the sentence, then show the rules.
  useEffect(() => {
    if (stage !== 'drafting') return;
    const timers = PHRASE_MS.map((ms, i) =>
      setTimeout(() => setLit(i + 1), ms),
    );
    timers.push(
      setTimeout(() => {
        setRules(draft.rules);
        setAnswers({});
        setMissing(null);
        setStage('check');
      }, DRAFT_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [stage, draft.rules]);

  /** Questions still waiting for an answer, on rules that are still there. */
  const openQuestions = draft.questions.filter(
    (q) =>
      rules.some((r) => r.id === q.ruleId) && answers[q.ruleId] === undefined,
  );
  const isOpen = (ruleId: string) =>
    !!questionFor(draft, ruleId) && answers[ruleId] === undefined;

  const typeText = (value: string) => {
    setText(value);
    if (error) setError(null);
  };

  const fillExample = () => typeText(draft.sentence);

  const startDrafting = () => {
    if (!text.trim()) {
      setError('Say or type your rules first.');
      return;
    }
    setError(null);
    setLit(0);
    setStage('drafting');
  };

  const cancelDrafting = () => {
    setLit(0);
    setStage('write');
  };

  /** Answers a rule's question with one of its options, which sets the rule's days. */
  const answer = (ruleId: string, option: number) => {
    const q = questionFor(draft, ruleId);
    if (!q) return;
    setRules((list) =>
      list.map((r) =>
        r.id === ruleId ? { ...r, days: q.options[option].days } : r,
      ),
    );
    setAnswers((a) => ({ ...a, [ruleId]: option }));
    if (missing === ruleId) setMissing(null);
  };

  const remove = (ruleId: string) => {
    const index = rules.findIndex((r) => r.id === ruleId);
    if (index < 0) return;
    const rule = rules[index];
    setRules((list) => list.filter((r) => r.id !== ruleId));
    if (missing === ruleId) setMissing(null);
    setEdit((e) => ({ ...e, open: false }));
    toast({
      text: `Removed “${rule.title}”`,
      action: {
        label: 'Undo',
        onClick: () =>
          setRules((list) =>
            list.some((r) => r.id === ruleId)
              ? list
              : [...list.slice(0, index), rule, ...list.slice(index)],
          ),
      },
    });
  };

  const startOver = () => {
    const before = { text, rules, answers };
    setStage('write');
    setText('');
    setRules([]);
    setAnswers({});
    setMissing(null);
    setError(null);
    setLit(0);
    toast({
      text: 'Started over',
      action: {
        label: 'Undo',
        onClick: () => {
          setText(before.text);
          setRules(before.rules);
          setAnswers(before.answers);
          setStage('check');
        },
      },
    });
  };

  const openEdit = (rule: Rule) =>
    setEdit({
      open: true,
      rule,
      value: {
        ruleId: rule.id,
        title: rule.title,
        who: rule.who,
        // A question still open means the days are not decided yet: nothing is picked.
        preset: isOpen(rule.id) ? '' : presetOf(rule.days),
        target: rule.target?.value ?? null,
        proof: rule.proof,
      },
    });

  const changeEdit = (patch: Partial<EditDraft>) =>
    setEdit((e) => (e.value ? { ...e, value: { ...e.value, ...patch } } : e));

  const closeEdit = (open: boolean) => setEdit((e) => ({ ...e, open }));

  /** Saves the sheet's changes into the drafted rule. False when something needs fixing first. */
  const saveEdit = () => {
    const v = edit.value;
    if (!v || !v.title.trim()) return false;
    const days = DAY_PRESETS.find((p) => p.id === v.preset)?.days ?? null;
    setRules((list) =>
      list.map((r) =>
        r.id !== v.ruleId
          ? r
          : {
              ...r,
              title: v.title.trim(),
              who: v.who,
              proof: v.proof,
              ...(days ? { days } : {}),
              ...(r.target && v.target !== null && v.target > 0
                ? { target: { ...r.target, value: v.target } }
                : {}),
            },
      ),
    );
    // Days picked in the editor answer the rule's question too.
    const q = questionFor(draft, v.ruleId);
    if (q && days) {
      const option = q.options.findIndex((o) => sameDays(o.days, days));
      setAnswers((a) => ({
        ...a,
        [v.ruleId]: option >= 0 ? option : 'custom',
      }));
      if (missing === v.ruleId) setMissing(null);
    }
    setEdit((e) => ({ ...e, open: false }));
    toast('Saved');
    return true;
  };

  /**
   * Use these rules: on to setup, unless a question is still open; then it says so on the question
   * and returns its rule's id so the page can move focus there.
   */
  const acceptRules = (): string | null => {
    const first = openQuestions[0];
    if (first) {
      setMissing(first.ruleId);
      return first.ruleId;
    }
    navigate('setup');
    return null;
  };

  return {
    world,
    draft,
    stage,
    text,
    error,
    lit,
    rules,
    answers,
    missing,
    edit,
    isOpen,
    typeText,
    fillExample,
    startDrafting,
    cancelDrafting,
    answer,
    remove,
    startOver,
    openEdit,
    changeEdit,
    closeEdit,
    saveEdit,
    acceptRules,
  };
}
