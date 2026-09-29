'use client';
import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNav, type PageId } from '@/components/next/nav';
import { Button } from '@/components/next/ui/button';

/**
 * The frame for everything before or outside a running challenge (landing, sign up, starting and
 * setting up, invite, pact, practice, the verdict): a quiet top bar with the product's name, or a
 * Back button when `back` is set, and one centred column.
 *
 * - `width`: 'narrow' (520px, forms and single decisions), 'normal' (720px, default), 'wide' (1080px).
 * - `center`: centres short content vertically (sign in, an invite).
 * - `aside`: something small on the right of the top bar ("Sign in").
 */
export function PlainFrame({
  children,
  back,
  aside,
  width = 'normal',
  center,
}: {
  children: ReactNode;
  back?: { to: PageId; label?: string };
  aside?: ReactNode;
  width?: 'narrow' | 'normal' | 'wide';
  center?: boolean;
}) {
  const { navigate } = useNav();
  const size = {
    'data-narrow': width === 'narrow' || undefined,
    'data-wide': width === 'wide' || undefined,
  };
  return (
    <div className="nx-frame" data-frame="plain">
      <header className="nx-main nx-topbar" {...size}>
        {back ? (
          <Button
            variant="quiet"
            icon={ChevronLeft}
            className="-ml-3"
            onClick={() => navigate(back.to)}
          >
            {back.label ?? 'Back'}
          </Button>
        ) : (
          <span className="nx-brand">The Challenge</span>
        )}
        {aside && (
          <div className="ml-auto flex items-center gap-2">{aside}</div>
        )}
      </header>
      <main
        className={cn(
          'nx-main nx-fade-in pt-2',
          center &&
            'flex min-h-[calc(100dvh-var(--nx-top-inset)-176px)] flex-col justify-center',
        )}
        {...size}
      >
        {children}
      </main>
    </div>
  );
}
