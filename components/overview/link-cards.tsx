'use client';
import { ArrowRight, BookOpen, Check } from 'lucide-react';
import { useChallenge } from '@/components/app/challenge-context';
import { reviewQueue } from '@/lib/selectors';

/** Shortcuts to Review (with what is waiting) and the Rules page. */
export function LinkCards() {
  const { data, me, go } = useChallenge();
  const count = reviewQueue(data, me.id).count;
  return (
    <div className="link-row">
      <button
        type="button"
        className={`glass link-card${count > 0 ? ' attention' : ''}`}
        onClick={() => go('Review')}
      >
        <span className="link-icon">
          <Check size={18} />
        </span>
        <span className="link-body">
          <b>Review</b>
          <small>
            {count > 0
              ? `${count} item${count === 1 ? '' : 's'} waiting for you`
              : 'All caught up'}
          </small>
        </span>
        <ArrowRight size={16} />
      </button>
      <button
        type="button"
        className="glass link-card"
        onClick={() => go('Rules')}
      >
        <span className="link-icon">
          <BookOpen size={18} />
        </span>
        <span className="link-body">
          <b>The rules</b>
          <small>What counts and what it costs</small>
        </span>
        <ArrowRight size={16} />
      </button>
    </div>
  );
}
