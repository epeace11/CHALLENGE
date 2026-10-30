// Rows: a tappable row inside a card, and the rules as one tagged list.
'use client';
import { ChevronDown, ChevronRight, type LucideIcon } from 'lucide-react';
import type { Rule } from '@/lib/next/model';
import { keepNumbersWithWords } from '@/lib/next/format';
import { cn } from '@/lib/utils';
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

/**
 * One row of a card that holds a few: an icon, a title, a detail and a chevron. Rows sit inset in
 * a card with `p-1.5`, so their hover fill keeps the card's rounded shape. With `expanded` it is a
 * disclosure (the chevron turns down) instead of opening a sheet.
 */
export function ListRow({
  icon: Icon,
  title,
  detail,
  onClick,
  expanded,
  controls,
}: {
  icon: LucideIcon;
  title: string;
  detail?: string;
  onClick: () => void;
  expanded?: boolean;
  controls?: string;
}) {
  const Chevron = expanded === undefined ? ChevronRight : ChevronDown;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-controls={controls}
      className="nx-press group flex min-h-16 w-full items-center gap-3.5 rounded-[18px] px-3.5 py-3 text-left hover:bg-nx-accent-soft/60"
    >
      <span
        aria-hidden="true"
        className="grid size-9 shrink-0 place-items-center rounded-nx-sm bg-nx-accent-soft text-nx-accent"
      >
        <Icon size={18} strokeWidth={2} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-nx-body leading-snug font-semibold text-pretty text-nx-ink">
          {keepNumbersWithWords(title)}
        </span>
        {detail && (
          <span className="text-pretty text-nx-2 text-nx-ink-2">
            {keepNumbersWithWords(detail)}
          </span>
        )}
      </span>
      <Chevron
        size={20}
        aria-hidden="true"
        className={cn(
          'shrink-0 text-nx-accent transition-transform duration-200 ease-nx',
          expanded === undefined && 'group-hover:translate-x-0.5',
          expanded && 'rotate-180',
        )}
      />
    </button>
  );
}
