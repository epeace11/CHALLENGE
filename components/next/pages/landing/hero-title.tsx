'use client';
import type { ReactNode } from 'react';

/** The landing page's title: the page title's Georgia, larger (30px on phones, up to 64px on a tall screen). */
export function HeroTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="nx-page-title text-[length:clamp(30px,min(2.4vw_+_20px,5.6vh),64px)] leading-[1.04] tracking-[-0.025em]">
      {children}
    </h1>
  );
}
