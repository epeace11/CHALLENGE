'use client';
import { useState, type CSSProperties } from 'react';
import { ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { useChallenge } from '@/components/app/challenge-context';
import { BadgeMedal, medalColors } from '@/components/progress/badge-medal';
import { formatDate, formatShortDate } from '@/lib/dates';
import type { Badge } from '@/lib/progress';
import { entriesOn } from '@/lib/selectors';

/** A few specks drifting out from the medal once, in its own colour: fixed, so every celebration looks the same. */
const SPECKS = Array.from({ length: 10 }, (_, i) => ({
  '--turn': `${i * 36 + (i % 2 ? 10 : -10)}deg`,
  '--reach': `${62 + (i % 3) * 10}px`,
  '--delay': `${260 + (i % 4) * 70}ms`,
})) as CSSProperties[];

/**
 * Celebrates badges the signed-in member has earned but not yet seen here: on opening the app for
 * ones earned while away, or the moment one is earned. It waits while a check-in is open, a save is
 * running or another dialog is up. Closing it counts them as seen; they stay marked New on Progress
 * for a few days.
 */
export function BadgeCelebration() {
  const { data, me, page, busy, log, dialogs, newBadges, go } = useChallenge();
  const [shown, setShown] = useState<Badge[]>([]),
    [open, setOpen] = useState(false);
  const checkingIn =
    page === 'Log' &&
    (log.editing !== false || !entriesOn(data, me.id, log.date).length);
  const calm =
    !checkingIn &&
    !busy &&
    !dialogs.view.entry &&
    !dialogs.view.habit &&
    !dialogs.view.day &&
    !dialogs.disputing &&
    !dialogs.pointRequest;
  const fresh = newBadges.fresh;
  if (!open && calm && fresh.length) {
    setShown(fresh);
    setOpen(true);
  } else if (open && fresh.some((b) => !shown.some((s) => s.id === b.id)))
    setShown([
      ...shown,
      ...fresh.filter((b) => !shown.some((s) => s.id === b.id)),
    ]);

  const close = (toBadges: boolean) => {
    newBadges.markSeen(shown.map((b) => b.id));
    setOpen(false);
    if (toBadges) go('Progress', 'badges');
  };
  const [first] = shown,
    many = shown.length > 1;
  if (!first) return null;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) close(false);
      }}
    >
      <DialogContent className="celebrate">
        <div
          className="celebrate-stage"
          aria-hidden="true"
          style={medalColors(first.id)}
        >
          <span className="celebrate-halo" />
          <span className="celebrate-halo" />
          {SPECKS.map((style, i) => (
            <i key={i} className="speck" style={style} />
          ))}
          <span className="celebrate-medal">
            <BadgeMedal id={first.id} earned size={88} />
            {many && <b className="celebrate-more">+{shown.length - 1}</b>}
          </span>
        </div>
        <p className="eyebrow">{many ? 'New badges' : 'Badge earned'}</p>
        <DialogTitle>
          {many ? `You earned ${shown.length} badges` : first.title}
        </DialogTitle>
        <DialogDescription>
          {many
            ? 'Here’s what you’ve unlocked. Every one is on your Progress page.'
            : `${first.how}.${first.date ? ` Earned ${formatDate(first.date)}.` : ''}`}
        </DialogDescription>
        {many && (
          <ul className="celebrate-list">
            {shown.map((b) => (
              <li key={b.id}>
                <BadgeMedal id={b.id} earned size={36} />
                <span className="celebrate-text">
                  <b>{b.title}</b>
                  <small>{b.how}</small>
                </span>
                {b.date && (
                  <time dateTime={b.date}>{formatShortDate(b.date)}</time>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="dialog-actions">
          <button className="primary" onClick={() => close(false)}>
            Keep going
          </button>
          <button onClick={() => close(true)}>
            See all badges <ArrowRight size={16} />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
