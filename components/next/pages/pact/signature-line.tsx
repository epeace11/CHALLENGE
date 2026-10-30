// A signature line: labelled with the person's name, inked while Hold to sign is held.
'use client';
import { dateIn, formatDate, formatTime } from '@/lib/next/selectors';
import { cn } from '@/lib/utils';
import { Avatar, useReducedMotion } from '@/components/next/ui';
import { CheckBadge, HOLD_MS, Script } from './parts';
import type { Signer } from './pact-data';

/**
 * One signature: a baseline with the name written on it once signed, and under it the person's
 * name and when they signed. An empty line inks from left to right while `holding` (in step with
 * Hold to sign's fill) and lets go when the hold does; `drawn` writes the name in. `size="sm"` is
 * the small pair under the countdown. The line is the same height signed or not, so signing moves
 * nothing.
 */
export function SignatureLine({
  signer,
  timeZone,
  drawn,
  holding,
  size = 'md',
  className,
}: {
  signer: Signer;
  timeZone: string;
  drawn?: boolean;
  holding?: boolean;
  size?: 'md' | 'sm';
  className?: string;
}) {
  const still = useReducedMotion();
  const { person, signedAt } = signer;
  const small = size === 'sm';
  // Signed: the ink stays full and fades into the drawn line under the name.
  const inked = holding || !!signedAt;
  return (
    <div className={cn('flex items-start gap-3.5', className)}>
      <Avatar
        person={person}
        size={small ? 'sm' : 'md'}
        decorative
        className={small ? 'mt-2' : 'mt-3'}
      />
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            'relative flex items-end',
            small ? 'h-[42px]' : 'h-[52px]',
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'absolute inset-x-0 bottom-0 border-b-[1.5px] border-nx-line-strong',
              !signedAt && 'border-dashed',
            )}
          />
          <span
            aria-hidden="true"
            className="absolute inset-x-0 -bottom-px h-[3px] origin-left rounded-full bg-nx-accent"
            style={{
              transform: `scaleX(${inked ? 1 : 0})`,
              opacity: signedAt ? 0 : 1,
              transition: still
                ? 'none'
                : holding
                  ? `transform ${HOLD_MS}ms linear`
                  : 'transform 200ms ease-out, opacity 300ms ease-out',
            }}
          />
          {signedAt && (
            <Script
              name={person.name}
              drawn={drawn}
              className={small ? 'text-[24px]' : undefined}
            />
          )}
          {signedAt && (
            <CheckBadge
              drawn={drawn}
              className={cn('ml-auto', small ? 'mb-1.5 size-8' : 'mb-2')}
            />
          )}
        </div>
        <p className="mt-2 text-nx-2 text-nx-ink-2">
          <span className="font-semibold text-nx-ink">{person.name}</span>
          {signedAt ? (
            ` · Signed ${formatDate(dateIn(timeZone, signedAt))} at ${formatTime(signedAt, timeZone)}`
          ) : (
            <span className="sr-only"> · Not signed yet</span>
          )}
        </p>
      </div>
    </div>
  );
}
