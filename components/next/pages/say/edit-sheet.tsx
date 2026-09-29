'use client';
import { Trash2 } from 'lucide-react';
import type { Rule, World } from '@/lib/next/model';
import {
  Button,
  NumberField,
  SegmentedControl,
  Sheet,
  TextField,
} from '@/components/next/ui';
import { DAY_PRESETS, unitWord } from './draft';
import { ChipGroup } from './options';
import type { EditDraft } from './use-say';

/**
 * Changes one drafted rule: its name, who it is for, its days, its target (number rules) and
 * whether it needs a screenshot. Save puts the changes on the draft; with `onRemove`, the rule can
 * also be removed from here.
 */
export function EditSheet({
  world,
  open,
  value,
  rule,
  onOpenChange,
  onChange,
  onSave,
  onRemove,
}: {
  world: World;
  open: boolean;
  value: EditDraft | null;
  /** The rule as it was when the sheet opened, so the sheet can slide away after Remove. */
  rule: Rule | null;
  onOpenChange: (open: boolean) => void;
  onChange: (patch: Partial<EditDraft>) => void;
  onSave: () => void;
  onRemove?: (ruleId: string) => void;
}) {
  if (!value || !rule) return null;
  const nameMissing = !value.title.trim();
  const unit = rule.target ? unitWord(rule.target.unit) : '';
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Edit rule"
      footer={
        <>
          {onRemove && (
            <Button icon={Trash2} onClick={() => onRemove(rule.id)}>
              Remove rule
            </Button>
          )}
          <Button variant="primary" disabled={nameMissing} onClick={onSave}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <TextField
          label="Rule"
          value={value.title}
          onChange={(title) => onChange({ title })}
          error={nameMissing ? 'Give the rule a name.' : undefined}
        />
        <div className="flex flex-col gap-2">
          <span className="nx-field-label" aria-hidden="true">
            Who
          </span>
          <SegmentedControl
            label="Who"
            value={value.who}
            onChange={(who) => onChange({ who })}
            options={[
              { value: 'both', label: 'Both' },
              { value: world.me.id, label: 'You' },
              { value: world.partner.id, label: world.partner.name },
            ]}
          />
        </div>
        <ChipGroup
          label="Days"
          value={value.preset}
          onChange={(preset) => onChange({ preset })}
          options={DAY_PRESETS}
          hint={value.preset === '' ? 'Not set yet.' : undefined}
        />
        {rule.target && (
          <NumberField
            label={`Target, in ${unit}`}
            value={value.target}
            onChange={(target) => onChange({ target })}
            unit={rule.target.unit}
            step={rule.target.value >= 1000 ? 500 : 1}
            min={1}
            hint={
              rule.target.op === '>='
                ? `At least this many ${unit} each day.`
                : `At most this many ${unit} each day.`
            }
          />
        )}
        <div className="flex flex-col gap-2">
          <span className="nx-field-label" aria-hidden="true">
            Screenshot
          </span>
          <SegmentedControl
            label="Screenshot"
            value={value.proof}
            onChange={(proof) => onChange({ proof })}
            options={[
              { value: 'none', label: 'None' },
              { value: 'optional', label: 'Optional' },
              { value: 'required', label: 'Required' },
            ]}
          />
        </div>
      </div>
    </Sheet>
  );
}
