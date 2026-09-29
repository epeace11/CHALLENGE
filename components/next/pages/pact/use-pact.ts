'use client';
import { useState } from 'react';
import { useNav } from '@/components/next/nav';
import { useToast } from '@/components/next/ui';
import { useDemo } from '@/components/next/world';
import { pactView, signPactAt } from './pact-data';

/** The sheets the pact opens: Day 1 and the first check-in, the dollar step, one rule, the whole pact. */
export type PactSheet = 'first' | 'step' | 'rule' | 'pact';

/**
 * What both pact versions share: the data, which sheet is open, and signing. Signing goes through
 * the shared sample world (signPact), so Overview and every other page see it; the toast's Undo
 * takes it back.
 */
export function usePact() {
  const { world, update, undo } = useDemo();
  const view = pactView(world);
  const { navigate } = useNav();
  const toast = useToast();
  const [sheet, setSheet] = useState<PactSheet | null>(null);
  // The rule in the rule sheet, kept after it closes so the sheet keeps its content while it falls.
  const [ruleId, setRuleId] = useState<string | null>(null);
  // True once Jordan presses Sign here, so his name is written in rather than already there.
  const [justSigned, setJustSigned] = useState(false);

  return {
    ...view,
    sheet,
    open: (next: PactSheet) => setSheet(next),
    close: () => setSheet(null),
    rule: view.challenge.rules.find((r) => r.id === ruleId) ?? null,
    openRule: (id: string) => {
      setRuleId(id);
      setSheet('rule');
    },
    justSigned,
    sign: () => {
      setJustSigned(true);
      update((w) => signPactAt(w, view.you.id, view.signAt));
      toast({
        text: 'You signed the pact',
        action: { label: 'Undo', onClick: undo },
      });
    },
    goToOverview: () => navigate('overview'),
    practice: () => navigate('practice'),
  };
}

export type PactFlow = ReturnType<typeof usePact>;
