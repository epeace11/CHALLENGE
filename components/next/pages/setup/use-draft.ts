'use client';
import { useMemo, useState } from 'react';
import type { Rule } from '@/lib/next/model';
import { useWorld } from '@/components/next/world';
import { draftFrom, draftStakes, type Draft } from './draft';

/**
 * The challenge being set up, in this page's state: its settings, its rules (add, edit, remove and
 * put back), and the stakes preview, which follows every change.
 */
export function useDraft() {
  const world = useWorld();
  const { me, partner } = world;
  const [draft, setDraft] = useState<Draft>(() => draftFrom(world.challenge));
  const people = useMemo(() => [me, partner], [me, partner]);
  const stakes = useMemo(() => draftStakes(draft, people), [draft, people]);

  const patch = (next: Partial<Draft>) => setDraft((d) => ({ ...d, ...next }));

  /** Adds a rule, or replaces the one with the same id. */
  const saveRule = (rule: Rule) =>
    setDraft((d) => ({
      ...d,
      rules: d.rules.some((r) => r.id === rule.id)
        ? d.rules.map((r) => (r.id === rule.id ? rule : r))
        : [...d.rules, rule],
    }));

  /** Takes a rule out; returns what Undo needs to put it back in its place. */
  const removeRule = (id: string) => {
    const index = draft.rules.findIndex((r) => r.id === id);
    if (index < 0) return null;
    const rule = draft.rules[index];
    setDraft((d) => ({ ...d, rules: d.rules.filter((r) => r.id !== id) }));
    return { rule, index };
  };

  const restoreRule = (rule: Rule, index: number) =>
    setDraft((d) =>
      d.rules.some((r) => r.id === rule.id)
        ? d
        : {
            ...d,
            rules: [...d.rules.slice(0, index), rule, ...d.rules.slice(index)],
          },
    );

  return {
    draft,
    patch,
    stakes,
    people,
    saveRule,
    removeRule,
    restoreRule,
  };
}
