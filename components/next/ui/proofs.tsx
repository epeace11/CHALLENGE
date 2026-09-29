'use client';
import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { ChevronLeft, ChevronRight, ImagePlus, X } from 'lucide-react';
import type { Proof } from '@/lib/next/model';
import { cn } from '@/lib/utils';
import { IconButton } from './button';
import { usePortalContainer } from './root';

/**
 * Screenshot thumbnails. Tapping one opens every screenshot full screen, with arrows (and ←/→) to
 * move between them. `onAdd` shows an "Add screenshot" tile; `onRemove` puts a remove button on each.
 * In the preview, add sample screenshots with stepsShot() or screenTimeShot() from lib/next/shots.
 */
export function ProofStrip({
  proofs,
  onAdd,
  onRemove,
  addLabel = 'Add screenshot',
  className,
}: {
  proofs: Proof[];
  onAdd?: () => void;
  onRemove?: (proofId: string) => void;
  addLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className={cn('nx-proofs', className)}>
      {proofs.map((p, i) => (
        <div key={p.id} className="relative">
          <button
            type="button"
            className="nx-proof"
            aria-label={`Open screenshot ${i + 1} of ${proofs.length}: ${p.alt}`}
            onClick={() => setOpen(i)}
          >
            <img src={p.src} alt="" draggable={false} />
          </button>
          {onRemove && (
            <button
              type="button"
              className="nx-proof-remove"
              aria-label={`Remove screenshot ${i + 1}`}
              onClick={() => onRemove(p.id)}
            >
              <span>
                <X size={15} strokeWidth={2.6} aria-hidden="true" />
              </span>
            </button>
          )}
        </div>
      ))}
      {onAdd && (
        <button type="button" className="nx-proof-add" onClick={onAdd}>
          <ImagePlus size={24} aria-hidden="true" />
          {addLabel}
        </button>
      )}
      <ProofViewer
        proofs={proofs}
        index={open}
        onIndex={setOpen}
        onClose={() => setOpen(null)}
      />
    </div>
  );
}

/** Full-screen screenshots. Open by passing an index; null closes it. */
export function ProofViewer({
  proofs,
  index,
  onIndex,
  onClose,
}: {
  proofs: Proof[];
  index: number | null;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const container = usePortalContainer();
  // Keep showing the last screenshot while the viewer fades out.
  const [shown, setShown] = useState(index ?? 0);
  if (index !== null && index !== shown) setShown(index);
  const i = Math.min(shown, Math.max(0, proofs.length - 1)),
    proof = proofs[i],
    many = proofs.length > 1;
  const go = (step: number) =>
    onIndex((i + step + proofs.length) % proofs.length);
  return (
    <Dialog.Root
      open={index !== null && !!proof}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal container={container}>
        <Dialog.Popup
          className="nx-viewer"
          onKeyDown={(e) => {
            if (!many) return;
            if (e.key === 'ArrowRight') go(1);
            if (e.key === 'ArrowLeft') go(-1);
          }}
        >
          <div className="nx-viewer-bar">
            <Dialog.Title className="flex-1 text-nx-2">
              {many ? `Screenshot ${i + 1} of ${proofs.length}` : 'Screenshot'}
            </Dialog.Title>
            <Dialog.Close className="nx-icon-btn" aria-label="Close">
              <X size={20} aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className="nx-viewer-stage">
            {proof && <img key={proof.id} src={proof.src} alt={proof.alt} />}
          </div>
          <div className="nx-viewer-foot">
            {many && (
              <IconButton
                icon={ChevronLeft}
                label="Previous screenshot"
                onClick={() => go(-1)}
              />
            )}
            <Dialog.Description className="min-w-0 flex-1 text-center">
              {proof?.alt}
            </Dialog.Description>
            {many && (
              <IconButton
                icon={ChevronRight}
                label="Next screenshot"
                onClick={() => go(1)}
              />
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
