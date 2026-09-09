'use client';
import { useEffect } from 'react';
/**
 * iOS Safari ignores `user-scalable=no`, so block pinch-zoom at the gesture
 * level. Double-tap zoom is already disabled by `touch-action: manipulation`.
 * Taps, scrolling and text fields are unaffected.
 */
export function NoZoom() {
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    const pinch = (e: TouchEvent) => { if (e.touches.length > 1) e.preventDefault(); };
    const opts: AddEventListenerOptions = { passive: false };
    document.addEventListener('gesturestart', block, opts);
    document.addEventListener('gesturechange', block, opts);
    document.addEventListener('gestureend', block, opts);
    document.addEventListener('touchmove', pinch, opts);
    return () => {
      document.removeEventListener('gesturestart', block);
      document.removeEventListener('gesturechange', block);
      document.removeEventListener('gestureend', block);
      document.removeEventListener('touchmove', pinch);
    };
  }, []);
  return null;
}
