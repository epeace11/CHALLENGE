'use client';
import { useNav } from '@/components/next/nav';
import { useWorld } from '@/components/next/world';
import { Button, Sheet } from '@/components/next/ui';
import { GROUP_ICON, keepTogether, ruleDetail, type Choice } from './choices';
import { Facts } from './parts';
import styles from './start.module.css';

/**
 * A theme or saved challenge in full: every rule with who it is for, when it is asked, how it is
 * answered and whether it needs a screenshot. The main action takes it to setup; a saved challenge
 * the couple already ran can also open how it ended.
 */
export function ChoiceSheet({
  open,
  choice,
  onOpenChange,
}: {
  open: boolean;
  choice: Choice | null;
  onOpenChange: (open: boolean) => void;
}) {
  const world = useWorld();
  const { navigate } = useNav();
  if (!choice) return null;
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={choice.name}
      description={choice.about}
      footer={
        <>
          {choice.ran && (
            <Button onClick={() => navigate('verdict')}>
              See how it ended
            </Button>
          )}
          <div data-look={choice.look} className="contents">
            <Button variant="primary" onClick={() => navigate('setup')}>
              {choice.kind === 'theme'
                ? 'Use this theme'
                : 'Use this challenge'}
            </Button>
          </div>
        </>
      }
    >
      <ul data-look={choice.look} className="flex flex-col">
        {choice.rules.map((rule, i) => {
          const Icon = GROUP_ICON[rule.group];
          const optional = choice.optionalIds.includes(rule.id);
          return (
            <li
              key={rule.id}
              className="nx-enter flex items-start gap-3.5 border-t border-nx-line py-3.5 first:border-t-0 first:pt-1 last:pb-0"
              style={{ ['--nx-i' as string]: i + 2 }}
            >
              <span className={styles.dot} aria-hidden="true">
                <Icon size={20} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
                <span className="text-nx-body font-semibold text-nx-ink">
                  {keepTogether(rule.title)}
                </span>
                <Facts
                  items={ruleDetail(world, rule)}
                  className="text-nx-2 text-nx-ink-2"
                />
              </span>
              {optional && <span className="nx-pill mt-1">Optional</span>}
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
