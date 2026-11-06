'use client';
import { useId } from 'react';
import type { Pairing } from '@/lib/next/model';
import { Avatar } from '@/components/next/ui';

/**
 * Who a new challenge is with, asked in words: each partner with their avatar, or someone new. Chips
 * wrap, so any number of partners and any length of name fits.
 */
export function WhoWith({
  value,
  onChange,
  partners,
}: {
  value: string;
  onChange: (couple: string) => void;
  partners: Pairing[];
}) {
  const name = useId();
  const chip =
    'nx-press flex min-h-11 max-w-full cursor-pointer items-center gap-2 rounded-full border border-nx-field-line px-3 py-1.5 text-nx-body text-nx-ink has-checked:border-nx-accent has-checked:bg-nx-accent-soft has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-nx-accent';
  const radio = (id: string) => (
    <input
      type="radio"
      name={name}
      className="sr-only"
      checked={value === id}
      onChange={() => onChange(id)}
    />
  );
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="nx-field-label mb-2">Who’s it with?</legend>
      <div className="flex flex-wrap gap-2">
        {partners.map((p) => (
          <label key={p.coupleId} className={chip}>
            {radio(p.coupleId)}
            <Avatar person={p.person} decorative size="sm" />
            <span className="min-w-0 truncate">{p.person.name}</span>
          </label>
        ))}
        <label className={chip}>
          {radio('new')}
          Someone new
        </label>
      </div>
      {value === 'new' && (
        <p className="text-nx-2 text-nx-ink-2">
          You’ll invite them once it’s set up.
        </p>
      )}
    </fieldset>
  );
}
