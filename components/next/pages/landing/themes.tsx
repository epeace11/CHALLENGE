'use client';
import {
  Dumbbell,
  Flame,
  ListChecks,
  MoonStar,
  WineOff,
  type LucideIcon,
} from 'lucide-react';
import type { Theme } from '@/lib/next/model';
import { cn } from '@/lib/utils';

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
        background: 'var(--nx-fill)',
        boxShadow: 'var(--nx-fill-shadow)',
      }}
      aria-hidden="true"
    >
      <Icon size={22} strokeWidth={2} />
    </span>
  );
}

/** A theme as a small tile (its name and facts, and its icon on wider screens), two to a row. */
export function ThemeTile({
  theme,
  facts,
  onClick,
}: {
  theme: Theme;
  facts: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-look={theme.look}
      className="nx-glass nx-tappable flex h-full min-h-11 w-full items-center gap-3.5 px-3.5 py-3 text-left"
      onClick={onClick}
    >
      {/* On phones the name gets the whole width, so it fits in two lines. */}
      <ThemeIcon theme={theme} className="hidden sm:grid" />
      <span className="flex min-w-0 flex-col">
        <span className="text-nx-2 leading-snug font-semibold text-nx-ink sm:text-nx-body">
          {theme.name}
        </span>
        <span className="text-nx-min text-nx-ink-2 sm:text-nx-2">{facts}</span>
      </span>
    </button>
  );
}
