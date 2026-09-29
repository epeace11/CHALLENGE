import {
  BookOpen,
  Dumbbell,
  House,
  Moon,
  PiggyBank,
  Smartphone,
  Utensils,
  Wine,
  type LucideIcon,
} from 'lucide-react';
import type { RuleGroup } from '@/lib/next/model';

/** One icon per rule group, so a list of check-ins scans at a glance. */
export const GROUP_ICON: Record<RuleGroup, LucideIcon> = {
  Sleep: Moon,
  Screens: Smartphone,
  Food: Utensils,
  Drinks: Wine,
  Movement: Dumbbell,
  Mind: BookOpen,
  Money: PiggyBank,
  Home: House,
};
