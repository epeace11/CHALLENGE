'use client';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, Sheet } from '@/components/next/ui';

/**
 * Confirms deleting a challenge or a saved one for good, which can't be undone: it says what goes
 * and for whom. `name` stays set while the sheet closes, so it keeps its content as it falls.
 */
export function DeleteChallengeSheet({
  name,
  description,
  open,
  onOpenChange,
  onDelete,
}: {
  name: string;
  description: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => Promise<unknown> | void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete ${name} for good?`}
      description={description}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Keep it</Button>
          <Button
            variant="danger"
            icon={Trash2}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await onDelete();
              setBusy(false);
              onOpenChange(false);
            }}
          >
            Delete
          </Button>
        </>
      }
    />
  );
}

/** Deleting is this person's own: their partner keeps theirs. */
export const deletedForYouLine = (partner: string) =>
  `It’s gone from your account. ${partner} keeps theirs. This can’t be undone.`;
