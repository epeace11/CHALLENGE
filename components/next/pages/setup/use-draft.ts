'use client';
import { useMemo, useState } from 'react';
import type { Rule } from '@/lib/next/model';
import { useBackend } from '@/components/next/backend';
import { useWorld } from '@/components/next/world';
import { BLANK_NAME } from '@/lib/next/catalog';
import { draftFrom, draftStakes, type Draft } from './draft';

/**
 * The challenge being set up, in this page's state: its settings, its rules (add, edit, remove and
 * put back), and the stakes preview, which follows every change.
 */
export function useDraft() {
  const world = useWorld();
  const { host } = useBackend();
  const { me, partner } = world;
  // The name starts empty, as it is the first thing asked, unless a draft left earlier has one. A
  // challenge whose setup is done (the live app, invited or signing) keeps its name.
  const [draft, setDraft] = useState<Draft>(() => ({
    ...draftFrom(world.challenge),
    name: setupDone(world.challenge.status, !!host)
      ? world.challenge.name
      : world.challenge.status === 'draft' &&
          world.challenge.name !== BLANK_NAME
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

  /** Puts a removed rule back at `index` (its old place), unless it is already there. */
  const putBackRule = (rule: Rule, index: number) =>
    setDraft((d) => {
      if (d.rules.some((r) => r.id === rule.id)) return d;
      const rules = [...d.rules];
      rules.splice(Math.min(index, rules.length), 0, rule);
      return { ...d, rules };
    });

  return {
    draft,
    patch,
    stakes,
    people,
    saveRule,
    removeRule,
    putBackRule,
  };
}

/**
 * True once the challenge has been set up (invited or signing) in the live app: Set up then opens on
 * its checklist, where the name can still be changed, and never asks for the name again. The
 * preview's sample challenge is a running one, so there Set up always shows building a new one.
 */
export const setupDone = (status: string, live: boolean) =>
  live && (status === 'invited' || status === 'signing');
