'use client';
import { useId } from 'react';
import type { SavedChallenge } from '@/lib/next/model';
import { plural } from '@/lib/next/selectors';
import { useWorld } from '@/components/next/world';
import { Button, Sheet } from '@/components/next/ui';
import {
  ruleLine,
  rulesByWho,
  savedLine,
  sourceLine,
  stakesLine,
  startLabel,
} from './helpers';

/**
 * A saved challenge in full, one tap from its card: how long it runs, its stakes, and its rules
 * grouped by who has them; the main action starts it (Set up).
 */
export function SavedSheet({
  saved,
  open,
  onOpenChange,
  onStart,
}: {
  saved: SavedChallenge | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStart: () => void;
}) {
  const world = useWorld();
  return (
    <Sheet
      open={open && !!saved}
      onOpenChange={onOpenChange}
      title={saved?.name ?? 'Saved challenge'}
      description={
        saved
          ? saved.source === 'link'
            ? sourceLine(saved)
            : savedLine(saved)
          : undefined
      }
      footer={
        saved && (
          <Button variant="primary" onClick={onStart}>
            {startLabel(saved)}
          </Button>
        )
      }
    >
      {saved && (
        <div className="flex flex-col gap-6">
          <p className="rounded-nx bg-nx-accent-soft px-5 py-4 text-nx-body">
            {plural(saved.days, 'day')} · {stakesLine(saved)}
          </p>
          {rulesByWho(saved.rules, world.me, world.partner).map((g) => (
            <RuleGroup key={g.key} title={g.title} rules={g.rules} />
          ))}
        </div>
      )}
    </Sheet>
  );
}

function RuleGroup({
  title,
  rules,
}: {
  title: string;
  rules: SavedChallenge['rules'];
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h3 id={id} className="font-nx-sans text-nx-body font-semibold">
        {title}
      </h3>
      <ul className="flex flex-col gap-2">
        {rules.map((rule) => (
          <li key={rule.id} className="nx-card flex flex-col gap-0.5 px-4 py-3">
            <p className="text-nx-body font-semibold">{rule.title}</p>
            <p className="text-nx-2 text-nx-ink-2">{ruleLine(rule)}</p>
            {rule.description && (
              <p className="text-nx-2 text-nx-ink-2">{rule.description}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
