'use client';
import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNav, type PageId } from '@/components/next/nav';
import { Button } from '@/components/next/ui/button';
import { useFit } from './use-fit';

/**
 * The frame for everything before or outside a running challenge (landing, sign up, starting and
 * setting up, invite, pact, practice, the verdict): a quiet top bar with the product's name, or a
 * Back button when `back` is set, and one centred column, the same width as every other page.
 *
 * - `back`: a page to go back to (`to`), or a step back within the page (`onClick`).
 * - `center`: centres short content vertically (sign in, an invite).
 * - `aside`: something small on the right of the top bar ("Sign in").
 * - `brandTo`: where the product's name leads: Your challenges, or the landing page before signing in.
 */
export function PlainFrame({
  children,
  back,
  aside,
  center,
  brandTo = 'home',
}: {
  children: ReactNode;
  back?: { label?: string } & ({ to: PageId } | { onClick: () => void });
  aside?: ReactNode;
  center?: boolean;
  brandTo?: PageId;
}) {
  const { navigate } = useNav();
  const fit = useFit<HTMLDivElement>();
  return (
    <div ref={fit} className="nx-frame" data-frame="plain">
      <header className="nx-main nx-topbar">
        {back ? (
          <Button
            variant="quiet"
            icon={ChevronLeft}
            className="-ml-3"
            onClick={() => ('to' in back ? navigate(back.to) : back.onClick())}
          >
            {back.label ?? 'Back'}
          </Button>
        ) : (
          <button
            type="button"
            className="nx-brand nx-press -mx-2 min-h-11 rounded-nx-sm px-2"
            onClick={() => navigate(brandTo)}
          >
            The Challenge
          </button>
        )}
        {aside && (
          <div className="ml-auto flex items-center gap-2">{aside}</div>
        )}
      </header>
      <main
        className={cn(
          'nx-main nx-fade-in pt-2',
          center &&
            'flex min-h-[calc(100dvh-var(--nx-top-inset)-92px)] flex-col justify-center',
        )}
      >
        {children}
      </main>
    </div>
  );
}
