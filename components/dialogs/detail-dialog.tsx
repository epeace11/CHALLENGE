'use client';
import { useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useChallenge } from '@/components/app/challenge-context';
import { DayView } from './day-view';
import { EntryView } from './entry-view';
import { HabitView } from './habit-view';

/** The entry, habit and day views share one dialog. An entry opened from a habit or day view closes back to it; a tap outside closes everything. */
export function DetailDialog() {
  const { dialogs } = useChallenge();
  const { entry, habit, day } = dialogs.view;
  // Each switch starts at the top.
  useEffect(() => {
    document.querySelector('.detail-dialog')?.scrollTo(0, 0);
  }, [entry, habit, day]);
  return (
    <Dialog
      open={!!(entry || habit || day)}
      onOpenChange={(open, { reason }) => {
        if (open) return;
        if (reason === 'outside-press') dialogs.closeViews();
        else dialogs.closeTopView();
      }}
    >
      <DialogContent
        className={`detail-dialog${entry ? '' : habit ? ' habit-dialog' : ' day-dialog'}`}
      >
        {entry ? (
          <EntryView entry={entry} />
        ) : habit ? (
          <HabitView ruleId={habit} />
        ) : (
          day && <DayView d={day.d} uid={day.uid} />
        )}
      </DialogContent>
    </Dialog>
  );
}
