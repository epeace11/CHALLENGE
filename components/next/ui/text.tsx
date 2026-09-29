'use client';
import { useId, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The page's title in Georgia, with an optional kicker above (a short label, 15px), a detail line
 * below and an action on the right (an IconButton, never the main action).
 */
export function PageTitle({
  title,
  kicker,
  detail,
  action,
  className,
}: {
  title: ReactNode;
  kicker?: ReactNode;
  detail?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('nx-enter flex items-start gap-4 pt-2', className)}>
      <div className="min-w-0 flex-1">
        {kicker && <p className="nx-kicker mb-1.5">{kicker}</p>}
        <h1 className="nx-page-title">{title}</h1>
        {detail && <p className="mt-2 text-nx-body text-nx-ink-2">{detail}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

/**
 * A group of related things with an optional serif title and an action on the right (a quiet
 * Button such as "See all"). Enters with the page; `index` staggers it after earlier sections.
 */
export function Section({
  title,
  action,
  index = 0,
  id: anchor,
  className,
  children,
}: {
  title?: ReactNode;
  action?: ReactNode;
  index?: number;
  /** An anchor to link or scroll to. */
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      id={anchor}
      className={cn('nx-enter flex scroll-mt-24 flex-col gap-3', className)}
      style={{ ['--nx-i' as string]: index } as CSSProperties}
      aria-labelledby={title ? id : undefined}
    >
      {(title || action) && (
        <div className="flex min-h-11 items-center justify-between gap-3">
          {title ? (
            <h2 id={id} className="nx-section-title">
              {title}
            </h2>
          ) : (
            <span />
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
