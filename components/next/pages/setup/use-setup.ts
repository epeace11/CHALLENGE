'use client';
import { useEffect, useRef, useState } from 'react';
import type { Rule } from '@/lib/next/model';
import { useToast } from '@/components/next/ui';
import { useBackend, type SetupDraft } from '@/components/next/backend';
import { useNav } from '@/components/next/nav';
import { useWorld } from '@/components/next/world';
import { draftCap, draftDays, matchingRule, type Draft } from './draft';
import { useDraft } from './use-draft';

/** The draft as the live app saves it; a length still being typed keeps the saved one. */
const toSetup = (d: Draft, savedDays: number): SetupDraft => ({
  name: d.name.trim(),
  start: d.start,
  days: d.days ? draftDays(d) : savedDays,
  timeZone: d.timeZone,
  deadline: d.deadline,
  step: d.step,
  cap: draftCap(d),
  rules: d.rules,
});

/** The parts of setting up that can need attention, in page order. */
export type Part = 'details' | 'rules' | 'stakes';
export type Errors = Partial<Record<'name' | 'days' | 'cap' | 'rules', string>>;
export type SetupSheet = 'zone' | 'how' | 'library' | 'builder';

const PARTS: Record<Part, (keyof Errors)[]> = {
  details: ['name', 'days'],
  rules: ['rules'],
  stakes: ['cap'],
};

/** What is wrong with the draft, field by field. */
function problems(draft: Draft): Errors {
  return {
    name: draft.name.trim() ? undefined : 'Give it a name, like “Fall Reset”.',
    days: draft.days ? undefined : 'Enter how many days it runs.',
    cap:
      draft.capOn && !draft.cap
        ? 'Enter the most a gift can reach, or switch the cap off.'
        : undefined,
    rules: draft.rules.length ? undefined : 'Add at least one rule.',
  };
}

/** What one part of the draft still needs, in a few words ("Add at least one rule"), or undefined when it is ready. */
export const partProblem = (draft: Draft, part: Part) => {
  const found = problems(draft);
  return PARTS[part]
    .map((key) => found[key])
    .find(Boolean)
    ?.replace(/\.$/, '');
};

/** The first part with a problem, or null when everything is ready. */
const firstProblem = (found: Errors): Part | null =>
  (Object.keys(PARTS) as Part[]).find((part) =>
    PARTS[part].some((key) => found[key]),
  ) ?? null;

/**
 * The page's state: the draft, which sheet is open, the rule being built, the errors, removing a
 * rule with Undo, adding from the library, and finishing (the live app's finishSetup, or the
 * Invite page in the preview).
 */
export function useSetup() {
  const world = useWorld();
  const { navigate } = useNav();
  const { host } = useBackend();
  const toast = useToast();
  const drafted = useDraft();
  const { draft, saveRule, removeRule, restoreRule } = drafted;
  const [open, setOpen] = useState<SetupSheet | null>(null);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  // A challenge still in setup is saved a moment after each change and when the page closes, so
  // leaving keeps it on Your challenges with its name and rules.
  const autosave = !!host && world.challenge.status === 'draft';
  const first = useRef(draft);
  const pending = useRef<SetupDraft | null>(null);
  const flush = useRef(() => {});
  useEffect(() => {
    flush.current = () => {
      const d = pending.current;
      pending.current = null;
      if (d && host) void host.saveDraft(d);
    };
  }, [host]);
  useEffect(() => {
    if (!autosave || draft === first.current) return;
    pending.current = toSetup(draft, world.challenge.days);
    const t = setTimeout(() => flush.current(), 1000);
    return () => clearTimeout(t);
  }, [autosave, draft, world.challenge.days]);
  useEffect(() => () => flush.current(), []);

  const sheet = (name: SetupSheet) => ({
    open: open === name,
    onOpenChange: (next: boolean) => setOpen(next ? name : null),
  });
  const clear = (key: keyof Errors) => {
    if (errors[key]) setErrors({ ...errors, [key]: undefined });
  };

  const remove = (rule: Rule) => {
    const removed = removeRule(rule.id);
    if (removed)
      toast({
        text: `Removed “${rule.title}”`,
        action: {
          label: 'Undo',
          onClick: () => restoreRule(removed.rule, removed.index),
        },
      });
  };
  const toggleLibrary = (rule: Rule) => {
    const existing = matchingRule(draft.rules, rule);
    if (existing) remove(existing);
    else {
      saveRule(rule);
      clear('rules');
    }
  };
  const build = (rule: Rule | null) => {
    setEditing(rule);
    setOpen('builder');
  };
  const builderSaved = (rule: Rule, isNew: boolean) => {
    saveRule(rule);
    clear('rules');
    setOpen(null);
    toast(isNew ? `Added “${rule.title}”` : `Saved “${rule.title}”`);
  };

  /** Shows the errors of one part (or every part) and says whether it is ready. */
  const check = (part?: Part) => {
    const found = problems(draft);
    const keys = part ? PARTS[part] : (Object.keys(found) as (keyof Errors)[]);
    const shown: Errors = { ...errors };
    for (const key of keys) shown[key] = found[key];
    setErrors(shown);
    return keys.every((key) => !found[key]);
  };

  /** Shows the name's error, if any, and says whether the name is fine. */
  const checkName = () => {
    const error = problems(draft).name;
    setErrors({ ...errors, name: error });
    return !error;
  };

  /** Checks everything, then sends the challenge; `onProblem` shows the first part that needs attention. */
  const finish = (onProblem: (part: Part) => void) => {
    const found = problems(draft);
    setErrors(found);
    const first = firstProblem(found);
    if (first) return onProblem(first);
    if (!host) return navigate('invite');
    // Finishing saves everything, so a save still waiting would only repeat it.
    pending.current = null;
    setBusy(true);
    void host
      .finishSetup(toSetup(draft, world.challenge.days))
      .then(() => setBusy(false));
  };

  // With the partner already in, finishing signs it; they sign next time they open the app.
  const finishLabel =
    host && !world.partnerPending
      ? 'Sign and finish'
      : `Invite ${world.partner.name}`;

  return {
    ...drafted,
    world,
    open,
    setOpen,
    sheet,
    editing,
    errors,
    clear,
    remove,
    toggleLibrary,
    build,
    builderSaved,
    check,
    checkName,
    finish,
    finishLabel,
    busy,
  };
}

export type Setup = ReturnType<typeof useSetup>;
