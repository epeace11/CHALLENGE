'use client';
import { useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, Sheet } from '@/components/next/ui';

/** One entry in the Hidden list. */
export type HiddenItem = {
  id: string;
  name: string;
  detail: string;
  restore: () => void;
  remove: () => void;
};

/**
 * What this person has hidden, like an archive: each can come back to Your challenges, or be
 * deleted for good. It's only their own list; a partner's copy doesn't change.
 */
export function HiddenSheet({
  items,
  open,
  onOpenChange,
}: {
  items: HiddenItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // The last one restored or deleted: nothing left to show.
  useEffect(() => {
    if (open && !items.length) onOpenChange(false);
  }, [open, items.length, onOpenChange]);
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Hidden"
      description="Only on your account. Your partner still sees theirs."
      footer={<Button onClick={() => onOpenChange(false)}>Close</Button>}
    >
      <ul className="flex flex-col divide-y divide-nx-line">
        {items.map((item) => (
          <li key={item.id} className="flex flex-col gap-2 py-3">
            <div className="flex flex-col gap-0.5">
              <p className="text-nx-body font-semibold text-nx-ink">
                {item.name}
              </p>
              <p className="text-nx-2 text-nx-ink-2">{item.detail}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={item.restore}>Restore</Button>
              <Button
                variant="quiet"
                icon={Trash2}
                className="text-nx-danger"
                onClick={item.remove}
              >
                Delete for good
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
