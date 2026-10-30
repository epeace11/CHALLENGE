'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Keeps the screen's main action in reach: it sticks to the bottom of the screen, above the tab
 * bar, while the page scrolls. Put the primary Button first; a secondary action can follow (under
 * the primary on phones, to its left on wide screens). Toasts rise above it, so they never cover it.
 */
export function ActionBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
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
  return (
    <div ref={ref} className={cn('nx-action-bar', className)}>
      {children}
    </div>
  );
}
