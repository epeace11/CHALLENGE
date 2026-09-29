'use client';
import {
  ChevronRight,
  Dumbbell,
  Flame,
  ListChecks,
  MoonStar,
  WineOff,
  type LucideIcon,
} from 'lucide-react';
import type { Theme } from '@/lib/next/model';
import { cn } from '@/lib/utils';
import { themeFacts } from './content';

const ICONS: Record<string, LucideIcon> = {
  'seventy-five': Flame,
  sleep: MoonStar,
  dry: WineOff,
  fitness: Dumbbell,
};

/** The theme's icon on its own accent. Use it inside an element carrying the theme's data-look. */
export function ThemeIcon({
  theme,
  className,
}: {
  theme: Theme;
  className?: string;
}) {
  const Icon = ICONS[theme.id] ?? ICONS[theme.look] ?? ListChecks;
  return (
    <span
      className={cn(
        'grid size-11 shrink-0 place-items-center rounded-nx-sm text-nx-on-accent',
        className,
      )}
      style={{
        background: 'var(--nx-primary)',
        boxShadow: 'var(--nx-primary-shadow)',
      }}
      aria-hidden="true"
    >
      <Icon size={22} strokeWidth={2} />
    </span>
  );
}

/**
 * A theme as a compact card, in the theme's own colours: its icon, its name, and how long it runs
 * and how many rules it has. The whole card is one button.
 */
export function ThemeTile({
  theme,
  onClick,
}: {
  theme: Theme;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-look={theme.look}
      className="nx-glass nx-tappable h-full flex-col items-start gap-3 p-4 sm:p-5"
      onClick={onClick}
    >
      <span className="flex w-full items-start justify-between gap-2">
        <ThemeIcon theme={theme} />
        <ChevronRight
          className="nx-row-chevron mt-3"
          size={20}
          aria-hidden="true"
        />
      </span>
      <span className="text-nx-body font-semibold text-balance text-nx-ink sm:text-nx-lead">
        {theme.name}
      </span>
      <span className="mt-auto text-nx-2 text-nx-ink-2">
        {themeFacts(theme)}
      </span>
    </button>
  );
}
