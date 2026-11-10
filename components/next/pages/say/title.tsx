'use client';
import type { ReactNode, Ref } from 'react';

/**
 * The page title, like the kit's PageTitle, but focusable from code: when the page moves between
 * writing and checking, keyboard and screen reader users land on the new title.
 */
export function Title({
  ref,
  title,
}: {
  ref?: Ref<HTMLHeadingElement>;
  title: ReactNode;
}) {
  return (
    <header className="nx-enter pt-2">
      <h1 ref={ref} tabIndex={-1} className="nx-page-title outline-none">
        {title}
      </h1>
    </header>
  );
}
