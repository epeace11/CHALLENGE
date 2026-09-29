'use client';
import { useId, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import type { Rule, RuleGroup } from '@/lib/next/model';
import { libraryByGroup } from '@/lib/next/selectors';
import { Button, Glide, Sheet } from '@/components/next/ui';
import { cn } from '@/lib/utils';
import { FilterChips } from './fields';
import { matchingRule, ruleSummary } from './draft';
import styles from './setup.module.css';

type Filter = 'All' | RuleGroup;

/**
 * The rule library, grouped (Sleep, Screens, Food…), with chips to show one group. One tap adds a
 * rule for both of you; tapping an added rule takes it out again.
 */
export function LibrarySheet({
  open,
  onOpenChange,
  library,
  rules,
  onToggle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  library: Rule[];
  /** The draft's rules, to mark the ones already added. */
  rules: Rule[];
  onToggle: (rule: Rule) => void;
}) {
  const [filter, setFilter] = useState<Filter>('All');
  const groups = libraryByGroup(library);
  const shown =
    filter === 'All' ? groups : groups.filter((g) => g.group === filter);
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Add a rule"
      description="Rules you add are for both of you. Edit one to change who it’s for."
      footer={
        <Button variant="primary" onClick={() => onOpenChange(false)}>
          Done
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <FilterChips
          label="Show"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'All', label: 'All' },
            ...groups.map((g) => ({ value: g.group, label: g.group })),
          ]}
        />
        <Glide id={filter}>
          <div className="flex flex-col gap-7">
            {shown.map((g) => (
              <LibraryGroup
                key={g.group}
                group={g.group}
                rules={g.rules}
                added={rules}
                onToggle={onToggle}
              />
            ))}
          </div>
        </Glide>
      </div>
    </Sheet>
  );
}

function LibraryGroup({
  group,
  rules,
  added,
  onToggle,
}: {
  group: RuleGroup;
  rules: Rule[];
  added: Rule[];
  onToggle: (rule: Rule) => void;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h3 id={id} className="font-nx-serif text-nx-h3">
        {group}
      </h3>
      <ul className="flex flex-col gap-2">
        {rules.map((rule) => {
          const on = !!matchingRule(added, rule);
          return (
            <li key={rule.id}>
              <button
                type="button"
                aria-pressed={on}
                className={cn(
                  'nx-card nx-tappable min-h-16 items-center gap-3 py-3 pr-3 pl-4',
                  on && 'border-nx-accent-line',
                )}
                onClick={() => onToggle(rule)}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-nx-body font-semibold text-nx-ink">
                    {rule.title}
                  </span>
                  <span className="text-nx-2 text-nx-ink-2">
                    {ruleSummary(rule)}
                  </span>
                </span>
                <span className={styles.addMark} data-added={on || undefined}>
                  {on ? (
                    <Check
                      key="on"
                      size={18}
                      strokeWidth={2.4}
                      aria-hidden="true"
                    />
                  ) : (
                    <Plus
                      key="off"
                      size={18}
                      strokeWidth={2.4}
                      aria-hidden="true"
                    />
                  )}
                  {on ? 'Added' : 'Add'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
