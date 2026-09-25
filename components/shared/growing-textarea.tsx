'use client';
import { useEffect, useRef, type KeyboardEvent } from 'react';

/** Textarea that grows with its content, up to a cap. */
export function GrowingTextarea({
  value,
  onChange,
  onKeyDown,
  focusOnMount = false,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  focusOnMount?: boolean;
  'aria-label': string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [value]);
  useEffect(() => {
    const el = box.current;
    if (focusOnMount && el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [focusOnMount]);
  return (
    <textarea
      ref={box}
      rows={1}
      maxLength={4000}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      {...rest}
    />
  );
}
