'use client';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { useChallenge } from '@/components/app/challenge-context';
import { api } from '@/lib/api';
import { titleFor } from '@/lib/rules';

/** A dialog asking for one piece of text, then sending it. The text starts empty each time it opens. */
function TextDialog({
  target,
  onClose,
  title,
  description,
  label,
  placeholder,
  submitLabel,
  onSubmit,
}: {
  /** Whatever the dialog is about; null when closed. */
  target: object | null;
  onClose: () => void;
  title: string;
  description: string;
  label: string;
  placeholder?: string;
  submitLabel: string;
  onSubmit: (text: string) => Promise<unknown>;
}) {
  const { busy, run } = useChallenge();
  const [text, setText] = useState(''),
    [shown, setShown] = useState(target);
  if (shown !== target) {
    setShown(target);
    if (target) setText('');
  }
  return (
    <Dialog
      open={!!target}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <textarea
          aria-label={label}
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
        />
        <div className="dialog-actions">
          <button
            className="primary"
            disabled={!text.trim() || busy}
            onClick={() =>
              void run(async () => {
                await onSubmit(text);
                onClose();
              })
            }
          >
            {submitLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Disputing one of the partner's answers. */
export function DisputeDialog() {
  const { dialogs } = useChallenge();
  const entry = dialogs.disputing;
  return (
    <TextDialog
      target={entry}
      onClose={() => dialogs.setDisputing(null)}
      title="Dispute this entry"
      description="Explain what needs to be discussed."
      label="Dispute reason"
      submitLabel="Submit dispute"
      onSubmit={(comment) => api.review(entry!.id, 'dispute', comment)}
    />
  );
}

/** Asking the partner to forgive one of your points. */
export function ForgivenessDialog() {
  const { dialogs } = useChallenge();
  const point = dialogs.pointRequest;
  return (
    <TextDialog
      target={point}
      onClose={() => dialogs.setPointRequest(null)}
      title="Request forgiveness"
      description={`${titleFor(point?.rule_id ?? '')} · ${point?.day ?? ''}`}
      label="Forgiveness reason"
      placeholder="Why should this be forgiven?"
      submitLabel="Send request"
      onSubmit={(reason) => api.requestForgiveness(point!.id, reason)}
    />
  );
}
