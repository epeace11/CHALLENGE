/**
 * Pan and zoom for the screenshot viewer. The image sits centred in the stage at its fitted size;
 * a view moves its centre by (x, y) px and scales it about that centre. Points are px from the
 * stage centre. Pure, so tests/zoom.mjs covers it.
 */
export type View = { scale: number; x: number; y: number };
export type Size = { w: number; h: number };
export type Point = { x: number; y: number };

export const MAX_SCALE = 6;
export const fitted: View = { scale: 1, x: 0, y: 0 };

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/** The view brought inside its limits: scale 1–MAX_SCALE, and never panned past the image's edges (a side narrower than the stage stays centred). */
export function settle(v: View, image: Size, stage: Size): View {
  const scale = clamp(v.scale, 1, MAX_SCALE),
    ex = Math.max(0, (image.w * scale - stage.w) / 2),
    ey = Math.max(0, (image.h * scale - stage.h) / 2);
  // 0 + 0 rather than -0, so a settled view compares equal to `fitted`.
  return { scale, x: clamp(v.x, -ex, ex) + 0, y: clamp(v.y, -ey, ey) + 0 };
}

/** `v` scaled to `scale` about `at`: the part of the image under `at` stays under it. */
export function zoomAt(v: View, scale: number, at: Point): View {
  const k = scale / v.scale;
  return { scale, x: at.x - (at.x - v.x) * k, y: at.y - (at.y - v.y) * k };
}

/**
 * A two-finger pinch that started from `start` with the fingers `d0` apart around `m0`, now `d`
 * apart around `m`: the part of the image that was between the fingers follows them. The scale may
 * overshoot a little either way while pinching; settle() springs it back on release.
 */
export function pinch(
  start: View,
  m0: Point,
  d0: number,
  m: Point,
  d: number,
): View {
  const scale = clamp(start.scale * (d / d0), 0.7, MAX_SCALE * 1.2),
    k = scale / start.scale;
  return {
    scale,
    x: m.x - (m0.x - start.x) * k,
    y: m.y - (m0.y - start.y) * k,
  };
}

/** Double-tap: zoom in on the tapped point, far enough that a tall, narrow screenshot fills the width; zoomed in already, back out to fit. */
export function toggleZoom(v: View, at: Point, image: Size, stage: Size): View {
  if (v.scale > 1.01) return fitted;
  const scale = clamp(Math.max(2.5, stage.w / image.w), 1, MAX_SCALE);
  return settle(zoomAt(v, scale, at), image, stage);
}

/** What a one-finger drag at fitted size does when the finger lifts: page to the next or previous screenshot, close the viewer (a pull down), or snap back. */
export function release(
  axis: 'x' | 'y',
  d: number,
  ms: number,
  stage: Size,
): 'next' | 'prev' | 'close' | null {
  const speed = d / Math.max(ms, 1);
  if (axis === 'x') {
    if (d < -stage.w * 0.2 || speed < -0.45) return 'next';
    if (d > stage.w * 0.2 || speed > 0.45) return 'prev';
    return null;
  }
  return d > 110 || speed > 0.6 ? 'close' : null;
}
