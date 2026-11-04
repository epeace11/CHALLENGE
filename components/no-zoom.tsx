'use client';
import { useEffect } from 'react';
/**
 * The page never zooms: `touch-action: pan-x pan-y` (styles/touch.css) turns off pinch and
 * double-tap zoom, and since iOS Safari ignores `user-scalable=no`, pinches are also blocked at
 * the gesture level here. Taps, scrolling and text fields are unaffected, and the screenshot
 * viewer zooms its own image. If the page is zoomed anyway (an accessibility setting, or a
 * browser that lets a gesture through), the block lifts until it is pinched back to normal, so
 * nobody is left stuck zoomed in. Nothing listens to touchmove, so scrolling never waits for
 * script (dialogs and sheets lock the page behind them themselves).
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
    const opts: AddEventListenerOptions = { passive: false };
    mark();
    viewport?.addEventListener('resize', mark);
    document.addEventListener('gesturestart', block, opts);
    document.addEventListener('gesturechange', block, opts);
    document.addEventListener('gestureend', block, opts);
    return () => {
      viewport?.removeEventListener('resize', mark);
      document.removeEventListener('gesturestart', block);
      document.removeEventListener('gesturechange', block);
      document.removeEventListener('gestureend', block);
    };
  }, []);
  return null;
}
