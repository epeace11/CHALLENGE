'use client';
import { useEffect } from 'react';
/** True when the touch started inside an element that can actually scroll. */
const insideScrollable = (el: EventTarget | null) => {
  for (
    let n = el instanceof Element ? el : null;
    n && n !== document.body;
    n = n.parentElement
  ) {
    if (
      /auto|scroll/.test(getComputedStyle(n).overflowY) &&
      n.scrollHeight > n.clientHeight
    )
      return true;
  }
  return false;
};
/**
 * iOS Safari ignores `user-scalable=no`, so block pinch-zoom at the gesture
 * level. Double-tap zoom is already disabled by `touch-action: manipulation`.
 * Taps, scrolling and text fields are unaffected.
 *
 * It also ignores `overflow: hidden` on the page for touch drags, so while a
 * dialog is open a drag on a modal that doesn't overflow rubber-bands the page
 * behind it. Block those drags; drags inside genuinely scrollable content pass.
 */
export function NoZoom() {
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    const touch = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
        return;
      }
      if (
        document.querySelector('[data-slot=dialog-content]') &&
        !insideScrollable(e.target)
      )
        e.preventDefault();
    };
    const opts: AddEventListenerOptions = { passive: false };
    document.addEventListener('gesturestart', block, opts);
    document.addEventListener('gesturechange', block, opts);
    document.addEventListener('gestureend', block, opts);
    document.addEventListener('touchmove', touch, opts);
    return () => {
      document.removeEventListener('gesturestart', block);
      document.removeEventListener('gesturechange', block);
      document.removeEventListener('gestureend', block);
      document.removeEventListener('touchmove', touch);
    };
  }, []);
  return null;
}
