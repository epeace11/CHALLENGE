import type { CSSProperties } from 'react';
import {
  CalendarCheck,
  Dumbbell,
  Flag,
  Flame,
  Heart,
  Medal,
  Rocket,
  ShieldCheck,
  Sparkles,
  Trophy,
  type LucideIcon,
} from 'lucide-react';

/**
 * Each badge's icon and hue, by badge id in lib/progress.ts (badges). Every medal shares one soft
 * saturation and lightness (the --medal-* tokens in styles/base.css and dark.css), so only the hue
 * changes from badge to badge; `sat` greys one down further.
 */
const LOOK: Record<string, { icon: LucideIcon; hue: number; sat?: string }> = {
  first_clean: { icon: Sparkles, hue: 205 },
  clean_week: { icon: CalendarCheck, hue: 150 },
  streak7: { icon: Flame, hue: 28 },
  streak14: { icon: Flame, hue: 12 },
  streak30: { icon: Flame, hue: 350 },
  untouchable: { icon: ShieldCheck, hue: 228 },
  gym_regular: { icon: Dumbbell, hue: 178 },
  halfway: { icon: Flag, hue: 262 },
  gracious: { icon: Heart, hue: 330 },
  hat_trick: { icon: Trophy, hue: 42 },
  iron_week: { icon: Medal, hue: 215, sat: '9%' },
  strong_finish: { icon: Rocket, hue: 290 },
};
const FALLBACK = { icon: Sparkles, hue: 258 };

/** The variables that colour a badge's medal, for anything drawn around it too (the celebration's halo). */
export function medalColors(id: string) {
  const look = LOOK[id] ?? FALLBACK;
  return {
    '--medal-hue': String(look.hue),
    ...('sat' in look && look.sat ? { '--medal-sat': look.sat } : {}),
  } as CSSProperties;
}

/** A badge as a medal: a flat tint with a fine rim once earned, an empty ring until then. Decorative; the badge's title says what it is. */
export function BadgeMedal({
  id,
  earned,
  size = 48,
}: {
  id: string;
  earned: boolean;
  size?: number;
}) {
  const Icon = (LOOK[id] ?? FALLBACK).icon;
  return (
    <span
      className={`medal${earned ? '' : ' locked'}`}
      aria-hidden="true"
      style={
        {
          ...medalColors(id),
          '--medal-size': `${size}px`,
        } as CSSProperties
      }
    >
      <Icon size={Math.round(size * 0.42)} strokeWidth={1.75} />
    </span>
  );
}
