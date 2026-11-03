'use client';
import { useRef, useState, type ReactNode } from 'react';
import { Button } from './button';
import { TextField } from './fields';
import { Sheet } from './sheet';

/**
 * A sheet that asks for a few words before acting: a reason to dispute, a reply that keeps a
 * dispute open, a reason to forgive a miss. The field is focused when it opens; sending without
 * words says what is missing. `initial` starts the field with words written before. Give it a
 * `key` per item so a draft never carries over to another one.
 */
export function ReasonSheet({
  open,
  onOpenChange,
  title,
  description,
  label,
  submit,
  missing,
  hint,
  placeholder,
  initial = '',
  maxLength,
  finalFocus,
  onSubmit,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  label: string;
  submit: string;
  /** What the error says when the field is empty. */
  missing: string;
  hint?: string;
  placeholder?: string;
  initial?: string;
  maxLength?: number;
  /** See Sheet's `finalFocus`. */
  finalFocus?: () => HTMLElement | null;
  onSubmit: (text: string) => void;
  children?: ReactNode;
}) {
  const [text, setText] = useState(initial);
  const [error, setError] = useState(false);
  const field = useRef<HTMLElement | null>(null);
  const send = () => {
    const words = text.trim();
    if (!words) {
      // Back to the field, so a phone's keyboard comes back with the message.
      setError(true);
      field.current?.focus();
      return;
    }
    // The words stay while the sheet closes; each item's sheet has its own key.
    onSubmit(words);
    setError(false);
  };
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(false);
        onOpenChange(next);
      }}
      title={title}
      description={description}
      initialFocus={field}
      finalFocus={finalFocus}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" onClick={send}>
            {submit}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {children}
        <div
          ref={(el) => {
            field.current = el?.querySelector('textarea') ?? null;
          }}
        >
          <TextField
            label={label}
            multiline
            rows={3}
            hint={hint}
            placeholder={placeholder}
            maxLength={maxLength}
            value={text}
            onChange={(v) => {
              setText(v);
              if (v.trim()) setError(false);
            }}
            error={error ? missing : undefined}
          />
        </div>
      </div>
    </Sheet>
  );
}
