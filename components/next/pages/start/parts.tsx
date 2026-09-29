'use client';
import type { ReactNode } from 'react';
import { ChevronRight, type LucideIcon } from 'lucide-react';
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
 * A theme as a card in its look colour: a coloured band with its icon, then the name, days and
 * number of rules, and one sample rule. The whole card is one button that opens the theme's sheet.
 */
export function ThemeCard({
  choice,
  onOpen,
}: {
  choice: Choice;
  onOpen: () => void;
}) {
  const Icon = choice.icon;
  return (
    <button
      type="button"
      data-look={choice.look}
      className={cx('nx-glass nx-tappable', styles.card)}
      aria-haspopup="dialog"
      onClick={onOpen}
    >
      <span className={styles.band} aria-hidden="true">
        <Icon className={styles.bandIcon} size={30} strokeWidth={1.9} />
        <ChevronRight className={styles.bandChevron} size={22} />
      </span>
      <span className="flex flex-1 flex-col gap-1.5 p-4 sm:p-5">
        <span className="font-nx-serif text-nx-h3 text-nx-ink">
          {choice.name}
        </span>
        <Facts
          items={choice.facts}
          className="text-nx-2 font-semibold text-nx-accent-strong"
        />
        <SampleRule choice={choice} className="mt-auto pt-2" />
      </span>
    </button>
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

/** "Say your rules" and "Start blank": an icon, a title and one line, as one button. */
export function OwnCard({
  icon: Icon,
  title,
  detail,
  onClick,
  className,
}: {
  icon: LucideIcon;
  title: ReactNode;
  detail: ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cx(
        'nx-glass nx-tappable nx-row h-full items-center',
        className,
      )}
      onClick={onClick}
    >
      <span className={styles.dot} aria-hidden="true">
        <Icon size={22} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-nx-body font-semibold text-nx-ink">{title}</span>
        <span className="text-nx-2 text-nx-ink-2">{detail}</span>
      </span>
      <ChevronRight className="nx-row-chevron" size={22} aria-hidden="true" />
    </button>
  );
}
