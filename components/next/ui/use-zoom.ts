'use client';
import { useCallback, useRef, type PointerEvent } from 'react';
import {
  fitted,
  pinch,
  release,
  settle,
  toggleZoom,
  zoomAt,
  type Point,
  type View,
} from '@/lib/zoom';

type Gesture =
  | { kind: 'none' }
  /** One finger down, not yet moved far enough to be a drag (a tap, so far). */
  | { kind: 'press'; from: Point; at: number; onImage: boolean }
  | { kind: 'pan'; from: Point; view: View }
  | { kind: 'swipe'; from: Point; at: number; axis: 'x' | 'y' }
  | { kind: 'pinch'; view: View; mid: Point; gap: number };

/** What a gesture keeps between events. None of it is React state, so a drag never re-renders. */
type Zoom = {
  stage: HTMLDivElement | null;
  img: HTMLImageElement | null;
  view: View;
  pointers: Map<number, Point>;
  gesture: Gesture;
  lastTap: { at: number; p: Point } | null;
  /** The view a Safari trackpad pinch started from. */
  gestureFrom: View | null;
};

const idle: Gesture = { kind: 'none' },
  still: Point = { x: 0, y: 0 };
const mid = (a: Point, b: Point) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});
const gap = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) || 1;

/** The stage, and the image's fitted size (its layout box, which transforms leave alone). */
const sizes = (z: Zoom) => ({
  stage: { w: z.stage?.clientWidth || 1, h: z.stage?.clientHeight || 1 },
  image: { w: z.img?.offsetWidth || 1, h: z.img?.offsetHeight || 1 },
});

/** A pointer position relative to the stage's centre, where the image sits. */
const local = (z: Zoom, x: number, y: number): Point => {
  const r = z.stage?.getBoundingClientRect();
  return r
    ? { x: x - r.left - r.width / 2, y: y - r.top - r.height / 2 }
    : still;
};

/**
 * Shows view `v`. `shift` drags the image at fitted size (a swipe or a pull down); pulling down
 * also fades the viewer's backdrop (--pull), so the page shows through as a hint that letting go
 * closes it. `ease` animates the change over --nx-base, which is 0 under prefers-reduced-motion.
 */
function paint(z: Zoom, v: View, ease = false, shift = still) {
  z.view = v;
  if (z.img) {
    z.img.style.transition = ease
      ? 'transform var(--nx-base) var(--nx-ease)'
      : 'none';
    z.img.style.transform = `translate(${v.x + shift.x}px, ${v.y + shift.y}px) scale(${v.scale})`;
  }
  z.stage?.toggleAttribute('data-zoomed', v.scale > 1.01);
  z.stage?.parentElement?.style.setProperty(
    '--pull',
    String(Math.min(Math.max(shift.y, 0) / 400, 0.6)),
  );
}

/** Springs the view back inside its limits. */
function settleView(z: Zoom) {
  const { image, stage } = sizes(z);
  paint(z, settle(z.view, image, stage), true);
}

function zoomBy(z: Zoom, factor: number, at = still, ease = true) {
  const { image, stage } = sizes(z);
  paint(
    z,
    settle(zoomAt(z.view, z.view.scale * factor, at), image, stage),
    ease,
  );
}

/**
 * Pan and zoom for the full-screen screenshot viewer, on the maths in lib/zoom.ts: pinch,
 * double-tap, the wheel (and a trackpad pinch) zoom the screenshot, and a drag pans it while
 * zoomed. At fitted size a sideways swipe pages (`onPage`; leave it out when there is one
 * screenshot), and a pull down or a tap beside the image closes (`onClose`). Each new image
 * element starts fitted, so key the image by screenshot.
 *
 * Spread `stage` on the element the image is centred in (touch-action: none, so the browser leaves
 * its touches alone), put `img` on the image, and pass the dialog's keys to `onKey` (+, − and 0).
 * Destructure the result: the React Compiler lint reads `zoom.img` in render as a ref access.
 */
export function useZoom({
  onPage,
  onClose,
}: {
  onPage?: (step: 1 | -1) => void;
  onClose: () => void;
}) {
  const state = useRef<Zoom>({
    stage: null,
    img: null,
    view: fitted,
    pointers: new Map(),
    gesture: idle,
    lastTap: null,
    gestureFrom: null,
  });

  // The wheel and Safari's gesture events need listeners that can cancel, which React's are not.
  const stageRef = useCallback((el: HTMLDivElement | null) => {
    const z = state.current;
    z.stage = el;
    if (!el) return;
    z.pointers.clear();
    z.gesture = idle;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const step = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      // ctrlKey: a trackpad pinch in Chrome and Firefox, which moves in smaller steps.
      zoomBy(
        z,
        Math.exp(-step * (e.ctrlKey ? 0.01 : 0.0025)),
        local(z, e.clientX, e.clientY),
        false,
      );
    };
    // Safari on a Mac reports trackpad pinches as gesture events; on a phone the pointers handle the pinch.
    type SafariGesture = UIEvent & {
      scale: number;
      clientX: number;
      clientY: number;
    };
    const gestureStart = (e: Event) => {
      e.preventDefault();
      z.gestureFrom = z.pointers.size ? null : z.view;
    };
    const gestureChange = (e: Event) => {
      e.preventDefault();
      const from = z.gestureFrom,
        g = e as SafariGesture;
      if (!from) return;
      const { image, stage } = sizes(z);
      paint(
        z,
        settle(
          zoomAt(from, from.scale * g.scale, local(z, g.clientX, g.clientY)),
          image,
          stage,
        ),
      );
    };
    const opts = { passive: false };
    el.addEventListener('wheel', wheel, opts);
    el.addEventListener('gesturestart', gestureStart, opts);
    el.addEventListener('gesturechange', gestureChange, opts);
    return () => {
      el.removeEventListener('wheel', wheel);
      el.removeEventListener('gesturestart', gestureStart);
      el.removeEventListener('gesturechange', gestureChange);
      z.stage = null;
    };
  }, []);

  // A new image (another screenshot, or the viewer opened again) starts fitted.
  const imgRef = useCallback((el: HTMLImageElement | null) => {
    const z = state.current;
    z.img = el;
    if (!el) return;
    z.view = fitted;
    z.gesture = idle;
    z.lastTap = null;
    z.stage?.removeAttribute('data-zoomed');
    z.stage?.parentElement?.style.removeProperty('--pull');
  }, []);

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const z = state.current;
    // Keeps a drag that leaves the stage coming here; a pointer already gone can't be captured.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    const p = local(z, e.clientX, e.clientY);
    z.pointers.set(e.pointerId, p);
    const pts = [...z.pointers.values()];
    if (pts.length === 1)
      z.gesture = {
        kind: 'press',
        from: p,
        at: e.timeStamp,
        onImage: e.target === z.img,
      };
    else if (pts.length === 2) {
      // A second finger turns whatever was happening into a pinch from the current view.
      paint(z, z.view);
      z.gesture = {
        kind: 'pinch',
        view: z.view,
        mid: mid(pts[0], pts[1]),
        gap: gap(pts[0], pts[1]),
      };
    }
  };

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const z = state.current;
    if (!z.pointers.has(e.pointerId)) return;
    const p = local(z, e.clientX, e.clientY);
    z.pointers.set(e.pointerId, p);
    const g = z.gesture,
      pts = [...z.pointers.values()];
    if (g.kind === 'pinch') {
      if (pts.length >= 2)
        paint(
          z,
          pinch(g.view, g.mid, g.gap, mid(pts[0], pts[1]), gap(pts[0], pts[1])),
        );
      return;
    }
    if (g.kind === 'press') {
      const dx = p.x - g.from.x,
        dy = p.y - g.from.y;
      if (Math.hypot(dx, dy) < 8) return;
      // Zoomed in, a drag pans; at fitted size it swipes to another screenshot or pulls down to close.
      z.gesture =
        z.view.scale > 1.01
          ? { kind: 'pan', from: g.from, view: z.view }
          : {
              kind: 'swipe',
              from: g.from,
              at: g.at,
              axis: Math.abs(dx) > Math.abs(dy) ? 'x' : 'y',
            };
    }
    const now = z.gesture;
    if (now.kind === 'pan') {
      const { image, stage } = sizes(z);
      paint(
        z,
        settle(
          {
            ...now.view,
            x: now.view.x + p.x - now.from.x,
            y: now.view.y + p.y - now.from.y,
          },
          image,
          stage,
        ),
      );
    } else if (now.kind === 'swipe') {
      if (now.axis === 'x') {
        const dx = p.x - now.from.x;
        // With no other screenshot the image only gives a little.
        paint(z, fitted, false, { x: onPage ? dx : dx * 0.3, y: 0 });
      } else
        paint(z, fitted, false, { x: 0, y: Math.max(0, p.y - now.from.y) });
    }
  };

  const up = (e: PointerEvent<HTMLDivElement>) => {
    const z = state.current,
      p = z.pointers.get(e.pointerId);
    if (!p) return;
    z.pointers.delete(e.pointerId);
    const g = z.gesture,
      left = [...z.pointers.values()];
    if (g.kind === 'pinch') {
      // One finger left on the glass carries on as a pan; none left, and the view springs into its limits.
      if (left.length === 1)
        z.gesture = { kind: 'pan', from: left[0], view: z.view };
      else if (!left.length) {
        z.gesture = idle;
        settleView(z);
      }
      return;
    }
    z.gesture = idle;
    if (e.type === 'pointercancel') {
      settleView(z);
      return;
    }
    if (g.kind === 'press') {
      const last = z.lastTap;
      if (
        last &&
        e.timeStamp - last.at < 320 &&
        Math.hypot(p.x - last.p.x, p.y - last.p.y) < 40
      ) {
        z.lastTap = null;
        const { image, stage } = sizes(z);
        paint(z, toggleZoom(z.view, p, image, stage), true);
      } else if (!g.onImage && z.view.scale <= 1.01) onClose();
      else z.lastTap = { at: e.timeStamp, p };
    } else if (g.kind === 'swipe') {
      const { stage } = sizes(z),
        d = g.axis === 'x' ? p.x - g.from.x : p.y - g.from.y,
        next = release(g.axis, d, e.timeStamp - g.at, stage);
      if (next === 'close') onClose();
      else if (next && onPage) onPage(next === 'next' ? 1 : -1);
      else paint(z, fitted, true);
    } else if (g.kind === 'pan') settleView(z);
  };

  /** + and − zoom about the centre, 0 fits the screenshot again. */
  const onKey = (k: string) => {
    const z = state.current;
    if (k === '+' || k === '=') zoomBy(z, 1.5);
    else if (k === '-') zoomBy(z, 1 / 1.5);
    else if (k === '0') paint(z, fitted, true);
  };

  return {
    stage: {
      ref: stageRef,
      onPointerDown: down,
      onPointerMove: move,
      onPointerUp: up,
      onPointerCancel: up,
    },
    img: imgRef,
    onKey,
  };
}
