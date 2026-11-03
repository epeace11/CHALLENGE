'use client';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { WifiOff } from 'lucide-react';
import { Button, EmptyState, GlassCard } from '@/components/next/ui';

/** The card for when The Challenge can't be shown: what to check, and Try again. */
export function CantLoad({
  children,
  onRetry,
}: {
  children: ReactNode;
  onRetry: () => void;
}) {
  return (
    <main className="nx-main flex min-h-dvh flex-col justify-center">
      <GlassCard pad="lg" role="alert">
        <EmptyState
          icon={WifiOff}
          title="Can’t load The Challenge"
          action={
            <Button variant="primary" onClick={onRetry}>
              Try again
            </Button>
          }
        >
          {children}
        </EmptyState>
      </GlassCard>
    </main>
  );
}

/**
 * A page whose code didn't arrive: offline, or a deploy replaced the files it asked for (Chrome,
 * Safari and Firefox word it differently).
 */
const CODE_MISSING =
  /dynamically imported module|Importing a module script failed|Failed to fetch|Loading chunk|ChunkLoadError/i;

export const isMissingCode = (error: unknown) =>
  error instanceof Error &&
  (CODE_MISSING.test(error.message) || error.name === 'ChunkLoadError');

/** Try again: the page afresh, or the whole app when its code is missing (new files after a deploy). */
export function retryAfter(error: unknown, reset: () => void) {
  if (isMissingCode(error)) location.reload();
  else reset();
}

/**
 * Around the page on screen: when it throws while showing, the card instead of a blank screen. Try
 * again shows the page afresh (the registry fetches code that failed to load again on the next
 * mount). Keyed by the page, so moving to another page clears it too.
 */
export class PageBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return {
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="nx-frame">
        <CantLoad
          onRetry={() =>
            retryAfter(error, () => this.setState({ error: null }))
          }
        >
          {isMissingCode(error)
            ? 'Check that you’re online, then try again.'
            : 'Something went wrong on this page.'}
        </CantLoad>
      </div>
    );
  }
}
