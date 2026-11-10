'use client';
import { useRef, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { ChevronLeft, ChevronRight, ImagePlus, X } from 'lucide-react';
import type { Proof } from '@/lib/next/model';
import { cn } from '@/lib/utils';
import { IconButton } from './button';
import { usePortalContainer } from './root';
import { useZoom } from './use-zoom';

/**
 * The phone's photo picker, several screenshots at a time: put `input` on the page and call `open()`
 * from a tap. `onFiles` gets what was chosen. Closing the picker without choosing does nothing, and
 * nothing waits for it (phones don't all say when it closes). The input stays on the page, like the
 * original app's, so a picker that's slow to answer still lands.
 */
export function useImagePicker(onFiles: (files: File[]) => void) {
  const ref = useRef<HTMLInputElement>(null);
  const input = (
    <input
      ref={ref}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      multiple
      tabIndex={-1}
      aria-hidden="true"
      className="sr-only"
      onChange={(e) => {
        const files = Array.from(e.currentTarget.files ?? []);
        // Cleared, so choosing the same screenshot again still counts as a change.
        e.currentTarget.value = '';
        if (files.length) onFiles(files);
      }}
    />
  );
  return { input, open: () => ref.current?.click() };
}

/**
 * Screenshot thumbnails. Tapping one opens every screenshot full screen, with arrows (and ←/→) to
 * move between them. `onAdd` shows an "Add screenshot" tile, until there are `max`; `busy` turns it
 * into a spinner while one uploads. `onRemove` puts a remove button on each.
 * In the preview, add sample screenshots with stepsShot() or screenTimeShot() from lib/next/shots.
 */
export function ProofStrip({
  proofs,
  onAdd,
  onRemove,
  addLabel = 'Add screenshot',
  max = Infinity,
  busy,
  className,
}: {
  proofs: Proof[];
  onAdd?: () => void;
  onRemove?: (proofId: string) => void;
  addLabel?: string;
  max?: number;
  busy?: boolean;
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
            <img
              src={p.src}
              alt=""
              draggable={false}
              loading="lazy"
              decoding="async"
            />
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
      {/* Before the first screenshot, a wide drop-zone with the whole label; after it, a tile the
          size of a screenshot with only the icon (screen readers hear the label). */}
      {onAdd && (busy || proofs.length < max) && (
        <button
          type="button"
          className="nx-proof-add"
          data-wide={proofs.length === 0 || undefined}
          aria-label={
            busy ? 'Uploading screenshot' : proofs.length ? addLabel : undefined
          }
          aria-busy={busy || undefined}
          onClick={busy ? undefined : onAdd}
        >
          <span className="nx-proof-add-icon" aria-hidden="true">
            {busy ? <span className="nx-spinner" /> : <ImagePlus size={22} />}
          </span>
          {proofs.length ? null : busy ? 'Uploading…' : addLabel}
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

/**
 * Full-screen screenshots. Open by passing an index; null closes it. Arrows, swipes and ←/→ move
 * between them; pinch, double-tap, the wheel and + − 0 zoom, and a drag pans while zoomed (see
 * use-zoom.ts). Pulling the screenshot down or tapping beside it closes the viewer.
 */
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
  const { stage, img, onKey } = useZoom({
    onPage: many ? go : undefined,
    onClose,
  });
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
            if (many && e.key === 'ArrowRight') go(1);
            else if (many && e.key === 'ArrowLeft') go(-1);
            else onKey(e.key);
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
          <div className="nx-viewer-stage" {...stage}>
            {proof && (
              <img
                key={proof.id}
                ref={img}
                src={proof.src}
                alt={proof.alt}
                draggable={false}
              />
            )}
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
