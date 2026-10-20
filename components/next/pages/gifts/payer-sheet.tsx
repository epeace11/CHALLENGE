'use client';
import type { World } from '@/lib/next/model';
import { formatMoney, gets, partnerOf, plural } from '@/lib/next/selectors';
import { Button, Sheet } from '@/components/next/ui';
import { ledger, type PointRow } from './ledger';
import { PointRowButton, StepButton, type SheetFor } from './parts';

/**
 * One payer's points, oldest first so each costs one step more than the last, and what they
 * add up to. A row closes this sheet and opens the point; the step line opens "How gifts work".
 */
export function PayerSheet({
  sheet,
  world,
  onPoint,
  onHow,
}: {
  /** The payer's id. */
  sheet: SheetFor<string>;
  world: World;
  onPoint: (row: PointRow) => void;
  onHow: () => void;
}) {
  const payerId = sheet.target;
  if (!payerId) return null;
  const payer = payerId === world.me.id ? world.me : world.partner;
  const recipient = partnerOf(world, payerId);
  const rows = ledger(world, payerId);
  const total = gets(world, recipient.id);
  const active = rows.filter((r) => !r.forgiven).length;
  const mine = payerId === world.me.id;
  const close = () => sheet.setOpen(false);
  return (
    <Sheet
      open={sheet.open}
      onOpenChange={sheet.setOpen}
      title={mine ? 'Your points' : `${payer.name}’s points`}
      description={`${plural(active, 'point')} add up to the ${formatMoney(total)} gift ${
        mine ? `you buy ${recipient.name}` : 'you get'
      }.`}
      footer={
        <Button variant="primary" onClick={close}>
          Done
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        {rows.length ? (
          <ul className="flex flex-col gap-2.5">
            {rows.map((row) => (
              <li key={row.point.id}>
                <PointRowButton
                  row={row}
                  onOpen={() => {
                    close();
                    onPoint(row);
                  }}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-2 text-nx-body text-nx-ink-2">No points yet.</p>
        )}
        <StepButton
          world={world}
          onClick={() => {
            close();
            onHow();
          }}
        />
      </div>
    </Sheet>
  );
}
