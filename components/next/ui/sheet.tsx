'use client';
import type { ReactNode, RefObject } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePortalContainer } from './root';

/**
 * Details one tap away: a bottom sheet on phones that rises from the bottom, and a centred dialog
 * from 640px. It traps focus, closes on Escape, on the backdrop and on its close button, and returns
 * focus to what opened it.
 *
 * Put the actions in `footer`, the main action last (it shows first on phones and rightmost on wide
 * screens). "How it works" explanations belong here rather than on the page.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  footer,
  initialFocus,
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
