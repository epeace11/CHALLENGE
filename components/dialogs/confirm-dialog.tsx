'use client';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { useChallenge } from '@/components/app/challenge-context';

/** A decision that cannot be taken back, described before it is made. */
export type ConfirmRequest = {
  title: string;
  description: string;
  label: string;
  action: () => Promise<unknown>;
};

/** Asks once before an irreversible action. The last request stays rendered while the dialog closes. */
export function ConfirmDialog({
  request,
  onClose,
}: {
  request: ConfirmRequest | null;
  onClose: () => void;
}) {
  const { busy } = useChallenge();
  const [shown, setShown] = useState(request);
  if (request && request !== shown) setShown(request);
  return (
    <Dialog
      open={!!request}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogTitle>{shown?.title}</DialogTitle>
        <DialogDescription>{shown?.description}</DialogDescription>
        <div className="dialog-actions">
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              void (async () => {
                await shown?.action();
                onClose();
              })()
            }
          >
            {shown?.label}
          </button>
          <button disabled={busy} onClick={onClose}>
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
