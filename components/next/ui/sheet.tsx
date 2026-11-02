'use client';
import type { ReactNode, RefObject } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { ChevronLeft, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePortalContainer } from './root';

/**
 * Details one tap away: a bottom sheet on phones that rises from the bottom, and a centred dialog
 * from 640px. It traps focus, closes on Escape, on the backdrop and on its close button, and returns
 * focus to what opened it.
 *
 * Put the actions in `footer`, the main action last (it shows first on phones and rightmost on wide
 * screens). "How it works" explanations belong here rather than on the page. A sheet that steps
 * into a detail passes `back`, which puts a Back arrow before the title instead of a row of its own.
 * Keep what a sheet shows short enough to fit without scrolling; only a long list should scroll.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  footer,
  initialFocus,
  back,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Always set: it names the sheet for screen readers. */
  title: ReactNode;
  /** One sentence under the title. */
  description?: ReactNode;
  footer?: ReactNode;
  /** What to focus when it opens (a text field); by default the first focusable element. */
  initialFocus?: RefObject<HTMLElement | null>;
  /** A way back to the view this one came from: a Back arrow named "Back to {label}". */
  back?: { label: string; onClick: () => void };
  className?: string;
  children?: ReactNode;
}) {
  const container = usePortalContainer();
  return (
    <Dialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <Dialog.Portal container={container}>
        <Dialog.Backdrop className="nx-scrim" />
        <Dialog.Popup
          className={cn('nx-sheet', className)}
          initialFocus={initialFocus}
        >
          <div className="nx-sheet-grabber" aria-hidden="true" />
          <div className="nx-sheet-head">
            {back && (
              <button
                type="button"
                className="nx-icon-btn nx-sheet-back"
                aria-label={`Back to ${back.label}`}
                onClick={back.onClick}
              >
                <ChevronLeft size={22} strokeWidth={2} aria-hidden="true" />
              </button>
            )}
            <Dialog.Title className="nx-sheet-title">{title}</Dialog.Title>
            <Dialog.Close className="nx-icon-btn" aria-label="Close">
              <X size={20} strokeWidth={2} aria-hidden="true" />
            </Dialog.Close>
          </div>
          {description && (
            <Dialog.Description className="nx-sheet-description">
              {description}
            </Dialog.Description>
          )}
          {children && <div className="nx-sheet-body">{children}</div>}
          {footer && <div className="nx-sheet-foot">{footer}</div>}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
