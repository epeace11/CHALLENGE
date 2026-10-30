import {
  Check,
  CircleDashed,
  Clock3,
  HeartHandshake,
  MessageSquareWarning,
  Minus,
  X,
  type LucideIcon,
} from 'lucide-react';

/**
 * How a day (or one answer) went, as a day square shows it: done, forgiven, missed, waiting for
 * review, disputed, open to log, no visit (a weekly habit), not yet, or not asked that day.
 */
export type DayTone =
  | 'done'
  | 'excused'
  | 'missed'
  | 'review'
  | 'disputed'
  | 'open'
  | 'none'
  | 'ahead'
  | 'off';

const ICON: Partial<Record<DayTone, LucideIcon>> = {
  done: Check,
  excused: HeartHandshake,
  missed: X,
  review: Clock3,
  disputed: MessageSquareWarning,
  open: CircleDashed,
  none: Minus,
};

/**
 * The icon a day square carries, so a status never rests on colour alone. Days still ahead and days
 * not asked have none. Put it in an element with `className="nx-day" data-tone={tone}`: that is
 * the one way a day is drawn (the picked palette, frosted, with dark marks); size and layout are the
 * page's.
 */
export function DayIcon({ tone, size = 16 }: { tone: DayTone; size?: number }) {
  const Icon = ICON[tone];
  return Icon ? (
    <Icon size={size} strokeWidth={2.5} aria-hidden="true" />
  ) : null;
}
