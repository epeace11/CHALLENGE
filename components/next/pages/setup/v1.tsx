// Placeholder: replace this line with what is different about this version.
'use client';
import { PlainFrame } from '@/components/next/frames';
import { Placeholder } from '../placeholder';

/** Set up and rules, version 1. */
export default function SetupV1() {
  return (
    <PlainFrame>
      <Placeholder page="setup" version={1} />
    </PlainFrame>
  );
}
