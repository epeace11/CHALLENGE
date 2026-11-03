'use client';
import { useEffect } from 'react';
import { NxRoot } from '@/components/next/ui';
import {
  CantLoad,
  isMissingCode,
  retryAfter,
} from '@/components/live/cant-load';

/**
 * Anything /app throws outside the page on screen (which has its own boundary in
 * components/live/live-app.tsx): the same card, never a blank screen.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <NxRoot>
      <div className="nx-frame">
        <CantLoad onRetry={() => retryAfter(error, reset)}>
          {isMissingCode(error)
            ? 'Check that you’re online, then try again.'
            : 'Something went wrong. Try again.'}
        </CantLoad>
      </div>
    </NxRoot>
  );
}
