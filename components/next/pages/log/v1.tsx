// Placeholder: replace this line with what is different about this version.
'use client';
import { AppFrame } from '@/components/next/frames';
import { Placeholder } from '../placeholder';

/** Check in, version 1. */
export default function LogV1() {
  return (
    <AppFrame>
      <Placeholder page="log" version={1} />
    </AppFrame>
  );
}
