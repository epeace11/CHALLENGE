'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Keeps the screen's main action in reach: it sticks to the bottom of the screen, above the tab
 * bar, while the page scrolls. Put the primary Button first; a secondary action can follow (under
 * the primary on phones, to its left on wide screens). Toasts rise above it, so they never cover it.
 * `pinned` keeps it at the bottom of the screen even when the page is short, so a screen that is
 * repeated (Check in's questions) has its button in the same place each time; it leaves a space of
 * its own height where it was.
 */
export function ActionBar({
  children,
  className,
  pinned,
}: {
  children: ReactNode;
  className?: string;
  pinned?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const bar = ref.current,
      root = bar?.closest<HTMLElement>('.nx');
    if (!bar || !root) return;
    const measure = () =>
      root.style.setProperty('--nx-action-h', `${bar.offsetHeight + 12}px`);
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(bar);
    return () => {
      watch.disconnect();
      root.style.removeProperty('--nx-action-h');
    };
  }, []);
  const bar = (
    <div
      ref={ref}
      className={cn('nx-action-bar', className)}
      data-pinned={pinned || undefined}
    >
      {children}
    </div>
  );
  if (!pinned) return bar;
  return (
    <>
      {/* The bar's own height, less the 12px --nx-action-h adds for the space above it. */}
      <div aria-hidden="true" className="h-[calc(var(--nx-action-h)-12px)]" />
      {bar}
    </>
  );
}
