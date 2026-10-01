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
        background: 'var(--nx-primary)',
        boxShadow: 'var(--nx-primary-shadow)',
      }}
      aria-hidden="true"
    >
      <Icon size={22} strokeWidth={2} />
    </span>
  );
}
