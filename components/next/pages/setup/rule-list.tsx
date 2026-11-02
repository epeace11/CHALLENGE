'use client';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { Person, Rule } from '@/lib/next/model';
import {
  Avatar,
  Button,
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
import type { Removed } from './use-setup';
import styles from './setup.module.css';

/**
 * The draft's rules grouped as Both of you, Maya and Jordan. Rules slide in when added and out
 * when removed. Each rule shows Edit and Remove buttons. A rule just removed leaves a "Removed ·
 * No eating out" row with Undo in its place (`removed`), while the page keeps it.
 */
export function RuleList({
  rules,
  me,
  partner,
  onEdit,
  onRemove,
  removed,
  onUndo,
}: {
  rules: Rule[];
  me: Person;
  partner: Person;
  onEdit: (rule: Rule) => void;
  onRemove?: (rule: Rule) => void;
  removed?: Removed | null;
  onUndo?: () => void;
}) {
  const still = useReducedMotion();
  const move = { duration: still ? 0 : DURATION.base, ease: EASE };
  const leave = { duration: still ? 0 : DURATION.fast };
  // After Undo, the rule's own Remove button takes focus back.
  const [restored, setRestored] = useState<string | null>(null);
  // The removed rule keeps its place in the list (and its group) as the Undo row.
  const gone =
    removed && !rules.some((r) => r.id === removed.rule.id) ? removed : null;
  const shown = gone
    ? [...rules.slice(0, gone.index), gone.rule, ...rules.slice(gone.index)]
    : rules;
  if (shown.length === 0)
    return (
      <Card className="text-nx-body text-nx-ink-2">
        No rules yet. Add one from the library or build your own.
      </Card>
    );
  return (
    <div
      data-rule-list
      tabIndex={-1}
      className="relative flex flex-col gap-6 outline-none"
    >
      <Presence mode="popLayout" initial={false}>
        {rulesByWho(shown, me, partner).map((group) => (
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
                {group.rules.map((rule) => {
                  const isGone = rule.id === gone?.rule.id;
                  return (
                    <motion.li
                      key={isGone ? `removed-${rule.id}` : rule.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.97, transition: leave }}
                      transition={move}
                    >
                      {isGone ? (
                        <RemovedRow
                          rule={rule}
                          onUndo={() => {
                            setRestored(rule.id);
                            onUndo?.();
                          }}
                        />
                      ) : (
                        <ActionsRow
                          rule={rule}
                          onEdit={onEdit}
                          onRemove={onRemove}
                          focusRemove={restored === rule.id}
                        />
                      )}
                    </motion.li>
                  );
                })}
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
  focusRemove,
}: {
  rule: Rule;
  onEdit: (rule: Rule) => void;
  onRemove?: (rule: Rule) => void;
  /** Just put back with Undo: Remove takes focus again, where Undo was. */
  focusRemove?: boolean;
}) {
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusRemove)
      row.current
        ?.querySelector<HTMLElement>('[data-remove]')
        ?.focus({ preventScroll: true });
  }, [focusRemove]);
  return (
    <div ref={row} className="flex items-center gap-3 py-3 pr-3 pl-5">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-nx-body font-semibold">{rule.title}</p>
        <p className="text-nx-2 text-nx-ink-2">{ruleSummary(rule)}</p>
      </div>
      {/* Edit and Remove sit apart, so a tap meant for one doesn't land on the other. */}
      <div className="flex shrink-0 items-center gap-4">
        <IconButton
          icon={Pencil}
          label={`Edit ${rule.title}`}
          onClick={() => onEdit(rule)}
        />
        {onRemove && (
          <IconButton
            icon={Trash2}
            label={`Remove ${rule.title}`}
            data-remove
            onClick={() => onRemove(rule)}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Where a removed rule was: "Removed · No eating out" and Undo, which takes focus as the rule goes.
 * If the row leaves while it has focus, focus moves to the rule after it (or before it).
 */
function RemovedRow({ rule, onUndo }: { rule: Rule; onUndo: () => void }) {
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    row.current?.querySelector('button')?.focus({ preventScroll: true });
  }, []);
  useLayoutEffect(() => {
    const el = row.current;
    return () => {
      if (!el || !el.contains(document.activeElement)) return;
      const list = el.closest<HTMLElement>('[data-rule-list]');
      const buttons = [
        ...(list?.querySelectorAll<HTMLElement>('button') ?? []),
      ].filter((b) => !el.contains(b) && !b.closest('[data-removed]'));
      const after = buttons.find(
        (b) => el.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING,
      );
      (after ?? buttons.at(-1) ?? list)?.focus({ preventScroll: true });
    };
  }, []);
  return (
    <div
      ref={row}
      data-removed
      className="flex min-h-[72px] items-center gap-3 bg-nx-sunken py-2 pr-3 pl-5"
    >
      <output className="min-w-0 flex-1 text-nx-body text-nx-ink-2">
        <span className="font-semibold text-nx-ink">Removed</span> ·{' '}
        {rule.title}
      </output>
      <Button variant="quiet" onClick={onUndo}>
        Undo
      </Button>
    </div>
  );
}
