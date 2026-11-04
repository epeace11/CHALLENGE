'use client';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, Sheet } from '@/components/next/ui';

/**
 * Confirms deleting a challenge or a saved one, which can't be undone: it says what goes and for
 * whom. `name` stays set while the sheet closes, so it keeps its content as it falls.
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
      title={`Delete ${name}?`}
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

/** What deleting a challenge takes with it. */
export const deleteChallengeLine = (partner: string) =>
  `It’s gone for you and ${partner}: every answer, screenshot, point and gift. This can’t be undone.`;
