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
 * The page never zooms: `touch-action: pan-x pan-y` (styles/touch.css) turns off pinch and
 * double-tap zoom, and since iOS Safari ignores `user-scalable=no`, pinches are also blocked at
 * the gesture level here. Taps, scrolling and text fields are unaffected, and the screenshot
 * viewer zooms its own image. If the page is zoomed anyway (an accessibility setting, or a
 * browser that lets a gesture through), the block lifts until it is pinched back to normal, so
 * nobody is left stuck zoomed in.
 *
 * iOS also ignores `overflow: hidden` on the page for touch drags, so while a dialog is open a
 * drag on a modal that doesn't overflow rubber-bands the page behind it. Block those drags;
 * drags inside genuinely scrollable content pass.
 */
export function NoZoom() {
  useEffect(() => {
    const viewport = window.visualViewport,
      zoomed = () => (viewport?.scale ?? 1) > 1.01;
    const mark = () =>
      document.documentElement.toggleAttribute('data-zoomed', zoomed());
    const block = (e: Event) => {
      if (!zoomed()) e.preventDefault();
    };
    const touch = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        block(e);
        return;
      }
      if (
        document.querySelector('[data-slot=dialog-content]') &&
        !insideScrollable(e.target)
      )
        e.preventDefault();
    };
    const opts: AddEventListenerOptions = { passive: false };
    mark();
    viewport?.addEventListener('resize', mark);
    document.addEventListener('gesturestart', block, opts);
    document.addEventListener('gesturechange', block, opts);
    document.addEventListener('gestureend', block, opts);
    document.addEventListener('touchmove', touch, opts);
    return () => {
      viewport?.removeEventListener('resize', mark);
      document.removeEventListener('gesturestart', block);
      document.removeEventListener('gesturechange', block);
      document.removeEventListener('gestureend', block);
      document.removeEventListener('touchmove', touch);
    };
  }, []);
  return null;
}
