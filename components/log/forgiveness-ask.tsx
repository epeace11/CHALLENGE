'use client';
import { Checkbox } from '@/components/ui/checkbox';
import type { AskOption } from '@/lib/checkin';

/** Under a No: a forgiveness request that goes with the check-in's Save, or the status of the one already sent. */
export function ForgivenessField({
  option,
  checked,
  reason,
  partnerName,
  disabled,
  onCheck,
  onReason,
}: {
  option: AskOption;
  checked: boolean;
  reason: string;
  partnerName: string;
  disabled: boolean;
  onCheck: (on: boolean) => void;
  onReason: (reason: string) => void;
}) {
  if (option.kind === 'none') return null;
  if (option.kind === 'sent')
    return (
      <p className="muted forgiveness-status">
        {option.status === 'pending'
          ? `Forgiveness requested · waiting for ${partnerName}.`
          : `Forgiven by ${partnerName}.`}
      </p>
    );
  return (
    <div className={`forgiveness${checked ? ' on' : ''}`}>
      {option.again && (
        <p className="muted">
          {partnerName} said no last time. You can ask again with a new reason.
        </p>
      )}
      <label className="forgiveness-toggle">
        <Checkbox
          checked={checked}
          disabled={disabled}
          onCheckedChange={(v) => onCheck(Boolean(v))}
        />
        {option.again ? 'Ask again for forgiveness' : 'Request forgiveness'}
      </label>
      {checked && (
        <textarea
          aria-label="Why should this be forgiven? (required)"
          placeholder={`Why should ${partnerName} forgive this?`}
          value={reason}
          maxLength={2000}
          disabled={disabled}
          onChange={(e) => onReason(e.target.value)}
        />
      )}
    </div>
  );
}
