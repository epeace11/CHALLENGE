'use client';
import { useEffect, useState } from 'react';
import type { Instant } from '@/lib/next/model';
import { targetFor } from '@/lib/next/selectors';
import { useNav } from '@/components/next/nav';
import { useBackend } from '@/components/next/backend';
import { useWorld } from '@/components/next/world';
import { asSetter, pactView, pactViewer, signPactAt } from './pact-data';
import { forgetPactAsSetter, pactAsSetter } from './entry';

/** The sheets the pact opens: Day 1 and the first check-in, what a point costs, one rule, the whole pact, and Sign without holding. */
export type PactSheet = 'first' | 'step' | 'rule' | 'pact' | 'sign';

/** The pact's steps: the start and stakes, the rules, your own limits (when a rule has them), your signature. */
export type PactStep = 'start' | 'rules' | 'limits' | 'sign';

/**
 * What both pact versions share: the data, which sheet is open, your own limits, and signing.
 * Signing goes through the shared sample world (signPact), so Overview and every other page see it.
 * No toast: the signed screen shows it happened.
 */
export function usePact() {
  const sample = useWorld();
  const backend = useBackend();
  // Opened from Set up in the preview: the drafted challenge, from the side of the one who set it up.
  const [drafted] = useState(() => (backend.live ? null : pactAsSetter()));
  useEffect(forgetPactAsSetter, []);
  // There, signing changes nothing but this page (the sample world's challenge is another one).
  const [signedHere, setSignedHere] = useState<Instant | null>(null);
  const world = drafted ? asSetter(sample, drafted, signedHere) : sample;
  // The live app always shows the viewer's own side; the sample pact shows Jordan's, who hasn't signed.
  const view = pactView(
    world,
    drafted ? world.me : pactViewer(world, backend.live),
  );
  const { navigate } = useNav();
  const [sheet, setSheet] = useState<PactSheet | null>(null);
  // The rule in the rule sheet, kept after it closes so the sheet keeps its content while it falls.
  const [ruleId, setRuleId] = useState<string | null>(null);
  // True once you press Sign here, so your name is written in rather than already there.
  const [justSigned, setJustSigned] = useState(false);
  // Your own limits as typed, from the suggested target (or the one you set before).
  const [limits, setLimits] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(
      view.limitRules.map((r) => [
        r.id,
        targetFor(r, view.you.id)?.value ?? null,
      ]),
    ),
  );
  const own = Object.fromEntries(
    Object.entries(limits).filter(
      (e): e is [string, number] => e[1] !== null && e[1] > 0,
    ),
  );
  const steps: PactStep[] = [
    'start',
    'rules',
    ...(view.limitRules.length ? (['limits'] as const) : []),
    'sign',
  ];
  // Who set it up: they came from Set up, so Back on the first step goes there.
  const setterUp =
    !!drafted || (backend.live && world.invite.from === view.you.id);
  const partner = view.other.name;

  return {
    ...view,
    steps,
    sheet,
    open: (next: PactSheet) => setSheet(next),
    close: () => setSheet(null),
    rule: view.challenge.rules.find((r) => r.id === ruleId) ?? null,
    openRule: (id: string) => {
      setRuleId(id);
      setSheet('rule');
    },
    limits,
    setLimit: (id: string, value: number | null) =>
      setLimits((l) => ({ ...l, [id]: value })),
    /** Every limit filled in. */
    limitsSet: view.limitRules.every((r) => own[r.id] !== undefined),
    justSigned,
    sign: () => {
      setJustSigned(true);
      if (drafted) return setSignedHere(view.signAt);
      backend.act(
        {
          type: 'signPact',
          ...(view.limitRules.length ? { limits: own } : {}),
        },
        (w) => signPactAt(w, view.you.id, view.signAt, own),
      );
    },
    /** Back from the first step. */
    back: setterUp
      ? ('setup' as const)
      : backend.live
        ? ('home' as const)
        : ('invite' as const),
    /** After signing: Overview once both have; else the invite, or Your challenges to wait. */
    next: view.bothSigned
      ? { label: 'Go to Overview', go: () => navigate('overview') }
      : world.partnerPending
        ? {
            label: `Invite ${partner}`,
            // The live app shows the invite link until the partner joins.
            go: () => navigate(backend.live ? 'overview' : 'invite'),
          }
        : { label: 'Go to Your challenges', go: () => navigate('home') },
    practice: () => navigate('practice'),
  };
}

export type PactFlow = ReturnType<typeof usePact>;
