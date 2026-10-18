'use client';
import { useLayoutEffect, useRef } from 'react';

/**
 * Marks a frame `data-fits` while everything on its page fits on the screen, which drops the space
 * the frame keeps under the last thing (styles/next.css). So a page that fits never scrolls, not even
 * by that space; a longer page keeps it so its end doesn't sit on the screen's edge.
 */
export function useFit<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    const check = () => {
      // A fixed tab bar covers the bottom of the screen; content has to end above it.
      let nav = 0,
        bottom = 0;
      for (const child of frame.children) {
        const r = child.getBoundingClientRect();
        if (getComputedStyle(child).position === 'fixed') {
          if (r.height && r.bottom >= window.innerHeight - 1)
            nav = Math.max(nav, r.height);
        } else bottom = Math.max(bottom, r.bottom + window.scrollY);
      }
      const fits = Math.ceil(bottom + nav) <= window.innerHeight;
      if (fits !== frame.hasAttribute('data-fits'))
        frame.toggleAttribute('data-fits', fits);
    };
    check();
    const observer = new ResizeObserver(check);
    for (const child of frame.children) observer.observe(child);
    window.addEventListener('resize', check);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', check);
    };
  }, []);
  return ref;
}
