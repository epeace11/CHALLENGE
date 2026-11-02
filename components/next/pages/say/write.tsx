'use client';
import type { Ref } from 'react';
import { Mic } from 'lucide-react';
import { Button, Card, TextField } from '@/components/next/ui';
import { Sentence } from './drafting';

/** The big box for the rules, with the hint that the keyboard's microphone turns speech into text. */
export function RulesBox({
  ref,
  value,
  onChange,
  error,
  rows = 4,
}: {
  /** The wrapper, so the page can put the cursor back in the box. */
  ref?: Ref<HTMLDivElement>;
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  rows?: number;
}) {
  return (
    <div ref={ref}>
      <TextField
        label="Your rules"
        multiline
        rows={rows}
        value={value}
        onChange={onChange}
        placeholder="Who does what, and on which days"
        error={error}
        hint={
          <span className="flex items-start gap-2">
            <Mic
              size={18}
              className="mt-0.5 shrink-0 text-nx-accent"
              aria-hidden="true"
            />
            To talk instead of typing, tap the microphone on your keyboard.
          </span>
        }
      />
    </div>
  );
}

/** An example sentence to try, and the button that puts it in the box. */
export function Example({
  sentence,
  onUse,
  className,
}: {
  sentence: string;
  onUse: () => void;
  className?: string;
}) {
  return (
    <Card pad="sm" className={className}>
      {/* From 640px the button sits beside the sentence instead of under it. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-5">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="text-nx-2 font-semibold text-nx-ink-2">
            Example to try
          </p>
          <Sentence text={sentence} rules={[]} />
        </div>
        <Button className="self-start sm:shrink-0" onClick={onUse}>
          Use this example
        </Button>
      </div>
    </Card>
  );
}
