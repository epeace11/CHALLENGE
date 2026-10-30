'use client';
import { useMemo, useState } from 'react';
import type { Rule } from '@/lib/next/model';
import { useWorld } from '@/components/next/world';
import { BLANK_NAME } from '@/lib/next/catalog';
import { draftFrom, draftStakes, type Draft } from './draft';

/**
 * The challenge being set up, in this page's state: its settings, its rules (add, edit, remove and
 * put back), and the stakes preview, which follows every change.
 */
export function useDraft() {
  const world = useWorld();
  const { me, partner } = world;
  // The name starts empty, as it is the first thing asked, unless a draft left earlier has one.
  const [draft, setDraft] = useState<Draft>(() => ({
    ...draftFrom(world.challenge),
    name:
      world.challenge.status === 'draft' && world.challenge.name !== BLANK_NAME
        ? world.challenge.name
        : '',
  }));
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

  /** Takes a rule out. */
  const removeRule = (id: string) =>
    setDraft((d) => ({ ...d, rules: d.rules.filter((r) => r.id !== id) }));

  return {
    draft,
    patch,
    stakes,
    people,
    saveRule,
    removeRule,
  };
}
