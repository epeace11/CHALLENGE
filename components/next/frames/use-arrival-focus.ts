'use client';
import { useEffect, useRef } from 'react';

/** False until the first frame has mounted: opening the app moves no focus. */
let opened = false;

/**
 * After a move to another page, focus starts at the new page's title rather than at the top of the
 * document (the button that led here is gone with the old page), so keyboard and screen reader users
 * land where the page begins. A page that focuses something of its own on arrival keeps it.
 */
export function useArrivalFocus() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!opened) {
      opened = true;
      return;
    }
    const main = ref.current;
    const at = document.activeElement;
    if (!main || (at && at !== document.body)) return;
    const title = main.querySelector<HTMLElement>('h1');
    if (title) {
      if (!title.hasAttribute('tabindex')) title.tabIndex = -1;
      title.focus({ preventScroll: true });
    } else main.focus({ preventScroll: true });
  }, []);
  return ref;
}
