// Rows: the rules as one tagged list.
'use client';
import type { Rule } from '@/lib/next/model';
import { RuleLine } from './parts';
import type { PactFlow } from './use-pact';

/** A rule only one person checks in on says whose it is. */
export function ruleTag(rule: Rule, flow: PactFlow) {
  if (rule.who === 'both') return undefined;
  return rule.who === flow.you.id
    ? 'Only you'
    : `Only ${flow.theirs.person.name}`;
}

/** Every rule in one list, tagged when it is one person's; each opens its details. */
export function RuleList({ flow }: { flow: PactFlow }) {
  return (
    <div className="flex flex-col">
      {flow.challenge.rules.map((r) => (
        <RuleLine
          key={r.id}
          rule={r}
          tag={ruleTag(r, flow)}
          onOpen={flow.openRule}
        />
      ))}
    </div>
  );
}
