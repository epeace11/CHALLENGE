'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useChallenge } from '@/components/app/challenge-context';
import { START, shift } from '@/lib/dates';

/** Previous / date picker / next for the day being logged. */
export function DateControl() {
  const { busy, maxDate, log } = useChallenge();
  const { date, changeDate } = log;
  return (
    <div className="date-control">
      <button
        aria-label="Previous day"
        disabled={date <= START || busy}
        onClick={() => changeDate(shift(date, -1))}
      >
        <ChevronLeft size={17} />
      </button>
      <input
        aria-label="Date being logged"
        type="date"
        min={START}
        max={maxDate}
        value={date}
        disabled={busy}
        onChange={(e) => changeDate(e.target.value)}
      />
      <button
        aria-label="Next day"
        disabled={date >= maxDate || busy}
        onClick={() => changeDate(shift(date, 1))}
      >
        <ChevronRight size={17} />
      </button>
    </div>
  );
}
