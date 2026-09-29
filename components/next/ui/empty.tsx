'use client';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * When there is nothing to show: an icon, a plain title ("Nothing to review"), at most one short
 * sentence, and the action that helps next, if there is one.
 */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon: LucideIcon;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('nx-empty nx-enter', className)}>
      <span className="nx-empty-icon">
        <Icon size={28} aria-hidden="true" />
      </span>
      <h2 className="font-nx-serif text-nx-h2">{title}</h2>
      {children && (
        <p className="max-w-sm text-nx-body text-nx-ink-2">{children}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
