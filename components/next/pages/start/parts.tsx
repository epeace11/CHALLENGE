'use client';
import { ChevronRight } from 'lucide-react';
import { GROUP_ICON, keepTogether, type Choice } from './choices';
import styles from './start.module.css';
import { cx } from './cx';

/** A small square in a choice's look colour, with its icon. */
export function LookSwatch({
  choice,
  size = 'md',
}: {
  choice: Choice;
  size?: 'md' | 'lg';
}) {
  const Icon = choice.icon;
  return (
    <span
      data-look={choice.look}
      data-size={size === 'lg' ? 'lg' : undefined}
      className={styles.swatch}
      aria-hidden="true"
    >
      <Icon size={size === 'lg' ? 30 : 24} strokeWidth={2} />
    </span>
  );
}

/** Days and rules; each fact stays on one line when the line wraps. */
export function Facts({
  items,
  className,
}: {
  items: string[];
  className?: string;
}) {
  return (
    <span className={cx('flex flex-wrap gap-x-[0.3em]', className)}>
      {items.map((fact, i) => (
        <span key={i} className="whitespace-nowrap">
          {fact}
          {i < items.length - 1 ? ' ·' : ''}
        </span>
      ))}
    </span>
  );
}

/** The sample rule a card shows, with its group's icon. */
export function SampleRule({
  choice,
  className,
}: {
  choice: Choice;
  className?: string;
}) {
  const Icon = GROUP_ICON[choice.sample.group];
  return (
    <span
      className={cx(
        'flex items-start gap-2 text-nx-2 text-nx-ink-2',
        className,
      )}
    >
      <Icon
        size={18}
        className="mt-0.5 shrink-0 text-nx-accent"
        aria-hidden="true"
      />
      <span className="min-w-0">{keepTogether(choice.sample.title)}</span>
    </span>
  );
}

/**
 * A theme or saved challenge as one wide row: the look swatch, the name, days and number of rules,
 * and one sample rule. Opens the sheet.
 */
export function ChoiceRow({
  choice,
  onOpen,
  size = 'md',
}: {
  choice: Choice;
  onOpen: () => void;
  size?: 'md' | 'lg';
}) {
  return (
    <button
      type="button"
      data-look={choice.look}
      className={cx(
        'nx-glass nx-tappable nx-row h-full items-center',
        size === 'lg' && 'gap-4 py-5 pl-5',
      )}
      aria-haspopup="dialog"
      onClick={onOpen}
    >
      <LookSwatch choice={choice} size={size} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span
          className={cx(
            'text-nx-ink',
            size === 'lg'
              ? 'font-nx-serif text-nx-h3'
              : 'text-nx-body font-semibold',
          )}
        >
          {choice.name}
        </span>
        <Facts
          items={
            choice.sharedBy
              ? [...choice.facts, `From ${choice.sharedBy}`]
              : choice.facts
          }
          className="text-nx-2 text-nx-ink-2"
        />
        <SampleRule choice={choice} className="mt-0.5" />
      </span>
      <ChevronRight className="nx-row-chevron" size={22} aria-hidden="true" />
    </button>
  );
}
