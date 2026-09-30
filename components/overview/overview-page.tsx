'use client';
import { NotebookPen } from 'lucide-react';
import { useChallenge } from '@/components/app/challenge-context';
import { SummaryCard } from '@/components/progress/summary-card';
import { JournalFeed } from '@/components/shared/journal';
import { challengeRange, clampDate, daysLeft } from '@/lib/dates';
import { GiftCards } from './gift-cards';
import { LinkCards } from './link-cards';
import { MoneyBlock } from './ledger';
import { MonthCalendar } from './month-calendar';
import { ProgressStrip } from './progress-strip';
import { RecentEntries } from './recent-entries';
import { ReminderCard } from './reminder-card';
import { TodayCards } from './today-cards';

export function OverviewPage() {
  const { today, finalized } = useChallenge();
  const left = daysLeft(today),
    journalDay = clampDate(today);
  return (
    <>
      <div className="page-heading">
        <h1>The standings.</h1>
        <span className="eyebrow">
          {challengeRange} ·{' '}
          {left > 0 ? `${left} day${left === 1 ? '' : 's'} left` : 'finished'}
        </span>
      </div>
      <GiftCards />
      {finalized ? <SummaryCard /> : <ProgressStrip />}
      <TodayCards />
      <ReminderCard />
      <section className="glass journal" id="journal">
        <div className="row">
          <h3>
            <NotebookPen size={18} />
            Journal
          </h3>
          <span className="muted small">Both of you</span>
        </div>
        <JournalFeed day={journalDay} />
      </section>
      <LinkCards />
      <MonthCalendar />
      <RecentEntries />
      <MoneyBlock />
    </>
  );
}
