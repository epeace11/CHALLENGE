'use client';
import type { ReactNode } from 'react';

/** The landing page's title: the page title's Georgia, larger (38px on phones, up to 60px). */
export function HeroTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="nx-page-title text-[length:clamp(38px,3.4vw_+_24px,60px)] leading-[1.04] tracking-[-0.025em]">
      {children}
    </h1>
  );
}
