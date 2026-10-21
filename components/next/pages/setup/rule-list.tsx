'use client';
import { useId, type ReactNode } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { Person, Rule } from '@/lib/next/model';
import {
  Avatar,
  Card,
  GlassCard,
  IconButton,
  PairAvatars,
  Presence,
  motion,
  useReducedMotion,
  DURATION,
  EASE,
} from '@/components/next/ui';
import { cn } from '@/lib/utils';
import { rulesByWho, ruleSummary } from './draft';
import styles from './setup.module.css';

/**
 * The draft's rules grouped as Both of you, Maya and Jordan. Rules slide in when added and out
 * when removed. Each rule shows Edit and Remove buttons.
 */
export function RuleList({
  rules,
  me,
  partner,
  onEdit,
  onRemove,
}: {
  rules: Rule[];
  me: Person;
  partner: Person;
  onEdit: (rule: Rule) => void;
  onRemove?: (rule: Rule) => void;
}) {
  const still = useReducedMotion();
  const move = { duration: still ? 0 : DURATION.base, ease: EASE };
  const leave = { duration: still ? 0 : DURATION.fast };
  if (rules.length === 0)
    return (
      <Card className="text-nx-body text-nx-ink-2">
        No rules yet. Add one from the library or build your own.
      </Card>
    );
  return (
    <div className="relative flex flex-col gap-6">
      <Presence mode="popLayout" initial={false}>
        {rulesByWho(rules, me, partner).map((group) => (
          <motion.div
            key={group.key}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: leave }}
            transition={move}
          >
            <Group title={group.title} people={group.people}>
              <Presence mode="popLayout" initial={false}>
                {group.rules.map((rule) => (
                  <motion.li
                    key={rule.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97, transition: leave }}
                    transition={move}
                  >
                    <ActionsRow
                      rule={rule}
                      onEdit={onEdit}
                      onRemove={onRemove}
                    />
                  </motion.li>
                ))}
              </Presence>
            </Group>
          </motion.div>
        ))}
      </Presence>
    </div>
  );
}

function Group({
  title,
  people,
  children,
}: {
  title: string;
  people: Person[];
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2.5">
      <h3
        id={id}
        className="flex min-h-8 items-center gap-2.5 font-nx-sans text-nx-body font-semibold"
      >
        {people.length === 2 ? (
          <PairAvatars people={people} size="sm" />
        ) : (
          <Avatar person={people[0]} size="sm" decorative />
        )}
        {title}
      </h3>
      <GlassCard pad="none">
        <ul className={cn('relative', styles.list)}>{children}</ul>
      </GlassCard>
    </section>
  );
}

function ActionsRow({
  rule,
  onEdit,
  onRemove,
}: {
  rule: Rule;
  onEdit: (rule: Rule) => void;
  onRemove?: (rule: Rule) => void;
}) {
  return (
    <div className="flex items-center gap-2 py-3 pr-3 pl-5">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-nx-body font-semibold">{rule.title}</p>
        <p className="text-nx-2 text-nx-ink-2">{ruleSummary(rule)}</p>
      </div>
      <IconButton
        icon={Pencil}
        label={`Edit ${rule.title}`}
        onClick={() => onEdit(rule)}
      />
      {onRemove && (
        <IconButton
          icon={Trash2}
          label={`Remove ${rule.title}`}
          onClick={() => onRemove(rule)}
        />
      )}
    </div>
  );
}
