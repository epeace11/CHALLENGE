'use client';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  LoaderCircle,
  X,
} from 'lucide-react';
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

/** One screenshot in the viewer: its signed URL (undefined while signing) and its photo date, already worded. */
export type Shot = { url: string | undefined; date: string };

type Gesture =
  | { kind: 'none' }
  /** One finger down, not yet moved far enough to be a drag (a tap, so far). */
  | { kind: 'press'; from: Point; at: number; onImage: boolean }
  | { kind: 'pan'; from: Point; view: View }
  | { kind: 'swipe'; from: Point; at: number; axis: 'x' | 'y' }
  | { kind: 'pinch'; view: View; mid: Point; gap: number };

const mid = (a: Point, b: Point) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});
const gap = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) || 1;

/**
 * A full-screen gallery for one answer's screenshots: arrows, swipes and ←/→ move between them;
 * pinch, double-tap, the wheel and drags zoom and pan the screenshot itself. The viewer handles
 * every touch that starts in it (touch-action: none), so the browser never zooms the page, and
 * closing it leaves the app exactly as it was.
 */
export function ProofViewer({
  shots,
  index,
  onIndex,
  onClose,
}: {
  shots: Shot[];
  /** The screenshot shown, or null when the viewer is closed. */
  index: number | null;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  // The last index stays rendered while the viewer fades out.
  const [shown, setShown] = useState(index ?? 0);
  if (index !== null && index !== shown) setShown(index);
  const i = Math.min(shown, Math.max(shots.length - 1, 0)),
    shot = shots[i],
    many = shots.length > 1;
  const [zoomed, setZoomed] = useState(false),
    [loaded, setLoaded] = useState(''),
    [failed, setFailed] = useState('');

  const popup = useRef<HTMLDivElement>(null),
    stage = useRef<HTMLDivElement>(null),
    frame = useRef<HTMLDivElement>(null),
    img = useRef<HTMLImageElement>(null),
    view = useRef<View>(fitted),
    pointers = useRef(new Map<number, Point>()),
    gesture = useRef<Gesture>({ kind: 'none' }),
    lastTap = useRef<{ at: number; p: Point } | null>(null),
    gestureFrom = useRef<View | null>(null);

  /** The frame the image is centred in, and the image's fitted size (its layout box, which transforms leave alone). */
  const sizes = () => ({
    stage: {
      w: frame.current?.clientWidth ?? 1,
      h: frame.current?.clientHeight ?? 1,
    },
    image: {
      w: img.current?.offsetWidth || 1,
      h: img.current?.offsetHeight || 1,
    },
  });
  /** A pointer position relative to the centre of the image's frame. */
  const local = (x: number, y: number): Point => {
    const r = frame.current?.getBoundingClientRect();
    return r
      ? { x: x - r.left - r.width / 2, y: y - r.top - r.height / 2 }
      : { x: 0, y: 0 };
  };
  /** Moves the image. `shift` drags it at fitted size (swiping or pulling down); `ease` animates the change. */
  const paint = (v: View, ease = false, shift: Point = { x: 0, y: 0 }) => {
    view.current = v;
    const el = img.current;
    if (el) {
      el.style.transition = ease ? 'transform 0.25s ease' : 'none';
      el.style.transform = `translate(${v.x + shift.x}px, ${v.y + shift.y}px) scale(${v.scale})`;
    }
    // Pulling down fades the dark backdrop, so the app shows through as a hint that letting go closes it.
    popup.current?.style.setProperty(
      '--pull',
      String(Math.min(Math.max(shift.y, 0) / 400, 0.6)),
    );
    setZoomed(v.scale > 1.01);
  };
  const settleView = () => {
    const { image, stage: s } = sizes();
    paint(settle(view.current, image, s), true);
  };
  const close = () => {
    view.current = fitted;
    setZoomed(false);
    gesture.current = { kind: 'none' };
    onClose();
  };
  const go = (to: number) => {
    if (to < 0 || to >= shots.length || to === i) return;
    view.current = fitted;
    setZoomed(false);
    gesture.current = { kind: 'none' };
    onIndex(to);
  };
  const zoomBy = (factor: number, at: Point = { x: 0, y: 0 }) => {
    const { image, stage: s } = sizes(),
      v = view.current;
    paint(settle(zoomAt(v, v.scale * factor, at), image, s), true);
  };

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Keeps a drag that leaves the stage (or the screen edge) coming here; a pointer already gone can't be captured.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    const p = local(e.clientX, e.clientY);
    pointers.current.set(e.pointerId, p);
    const pts = [...pointers.current.values()];
    if (pts.length === 1)
      gesture.current = {
        kind: 'press',
        from: p,
        at: e.timeStamp,
        onImage: e.target === img.current,
      };
    else if (pts.length === 2) {
      // A second finger turns whatever was happening into a pinch from the current view.
      paint(view.current);
      gesture.current = {
        kind: 'pinch',
        view: view.current,
        mid: mid(pts[0], pts[1]),
        gap: gap(pts[0], pts[1]),
      };
    }
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = local(e.clientX, e.clientY);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current,
      pts = [...pointers.current.values()];
    if (g.kind === 'pinch') {
      if (pts.length >= 2)
        paint(
          pinch(g.view, g.mid, g.gap, mid(pts[0], pts[1]), gap(pts[0], pts[1])),
        );
      return;
    }
    if (g.kind === 'press') {
      const dx = p.x - g.from.x,
        dy = p.y - g.from.y;
      if (Math.hypot(dx, dy) < 8) return;
      gesture.current =
        view.current.scale > 1.01
          ? { kind: 'pan', from: g.from, view: view.current }
          : {
              kind: 'swipe',
              from: g.from,
              at: g.at,
              axis: Math.abs(dx) > Math.abs(dy) ? 'x' : 'y',
            };
    }
    const now = gesture.current;
    if (now.kind === 'pan') {
      const { image, stage: s } = sizes();
      paint(
        settle(
          {
            ...now.view,
            x: now.view.x + p.x - now.from.x,
            y: now.view.y + p.y - now.from.y,
          },
          image,
          s,
        ),
      );
    } else if (now.kind === 'swipe') {
      if (now.axis === 'x') {
        const dx = p.x - now.from.x,
          edge = (dx > 0 && i === 0) || (dx < 0 && i === shots.length - 1);
        // Past the first or last screenshot the image only gives a little.
        paint(fitted, false, { x: edge ? dx * 0.3 : dx, y: 0 });
      } else paint(fitted, false, { x: 0, y: Math.max(0, p.y - now.from.y) });
    }
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    const p = pointers.current.get(e.pointerId);
    if (!p) return;
    pointers.current.delete(e.pointerId);
    const g = gesture.current,
      left = [...pointers.current.values()];
    if (g.kind === 'pinch') {
      // One finger left on the glass carries on as a pan; none left, and the view springs into its limits.
      if (left.length === 1)
        gesture.current = { kind: 'pan', from: left[0], view: view.current };
      else if (!left.length) {
        gesture.current = { kind: 'none' };
        settleView();
      }
      return;
    }
    gesture.current = { kind: 'none' };
    if (e.type === 'pointercancel') {
      settleView();
      return;
    }
    if (g.kind === 'press') {
      const last = lastTap.current;
      if (
        last &&
        e.timeStamp - last.at < 320 &&
        Math.hypot(p.x - last.p.x, p.y - last.p.y) < 40
      ) {
        lastTap.current = null;
        const { image, stage: s } = sizes();
        paint(toggleZoom(view.current, p, image, s), true);
      } else if (!g.onImage && view.current.scale <= 1.01) close();
      else lastTap.current = { at: e.timeStamp, p };
    } else if (g.kind === 'swipe') {
      const { stage: s } = sizes(),
        d = g.axis === 'x' ? p.x - g.from.x : p.y - g.from.y,
        next = release(g.axis, d, e.timeStamp - g.at, s);
      if (next === 'close') close();
      else if (next === 'next' && i < shots.length - 1) go(i + 1);
      else if (next === 'prev' && i > 0) go(i - 1);
      else paint(fitted, true);
    } else if (g.kind === 'pan') settleView();
  };

  // The wheel and trackpad zoom the screenshot, not the page, so these listeners must be able to cancel.
  useEffect(() => {
    const el = stage.current;
    if (!el || index === null) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const { image, stage: s } = sizes(),
        v = view.current,
        at = local(e.clientX, e.clientY),
        step = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      paint(
        settle(
          zoomAt(
            v,
            v.scale * Math.exp(-step * (e.ctrlKey ? 0.01 : 0.0025)),
            at,
          ),
          image,
          s,
        ),
      );
    };
    // Safari on a Mac reports trackpad pinches as gesture events; on a phone the pointers above already handle the pinch.
    type SafariGesture = UIEvent & {
      scale: number;
      clientX: number;
      clientY: number;
    };
    const gstart = (e: Event) => {
      e.preventDefault();
      gestureFrom.current = pointers.current.size ? null : view.current;
    };
    const gchange = (e: Event) => {
      e.preventDefault();
      const start = gestureFrom.current,
        g = e as SafariGesture;
      if (!start) return;
      const { image, stage: s } = sizes();
      paint(
        settle(
          zoomAt(start, start.scale * g.scale, local(g.clientX, g.clientY)),
          image,
          s,
        ),
      );
    };
    const opts = { passive: false };
    el.addEventListener('wheel', wheel, opts);
    el.addEventListener('gesturestart', gstart, opts);
    el.addEventListener('gesturechange', gchange, opts);
    return () => {
      el.removeEventListener('wheel', wheel);
      el.removeEventListener('gesturestart', gstart);
      el.removeEventListener('gesturechange', gchange);
    };
  });

  // The neighbours load in the background, so paging never waits.
  const neighbours = [shots[i - 1]?.url, shots[i + 1]?.url].join(' ');
  useEffect(() => {
    if (index === null) return;
    for (const url of neighbours.split(' ')) if (url) new Image().src = url;
  }, [index, neighbours]);

  return (
    <DialogPrimitive.Root
      open={index !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Popup
          ref={popup}
          className="viewer"
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') go(i + 1);
            else if (e.key === 'ArrowLeft') go(i - 1);
            else if (e.key === '+' || e.key === '=') zoomBy(1.5);
            else if (e.key === '-') zoomBy(1 / 1.5);
            else if (e.key === '0') paint(fitted, true);
          }}
        >
          <DialogPrimitive.Title className="sr-only">
            Screenshot {i + 1} of {shots.length}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {shot?.date}. Pinch or double-tap to zoom
            {many ? '; swipe or use the arrows for the others' : ''}.
          </DialogPrimitive.Description>
          <div className="viewer-bar">
            <span className="viewer-count" aria-hidden={!many}>
              {many ? `${i + 1} / ${shots.length}` : ''}
            </span>
            <span className="viewer-date">{shot?.date}</span>
            {shot?.url && (
              <a
                className="viewer-button"
                href={shot.url}
                target="_blank"
                rel="noreferrer"
                aria-label="Open the original in a new tab"
                title="Open the original"
              >
                <ExternalLink size={18} />
              </a>
            )}
            <DialogPrimitive.Close
              className="viewer-button"
              aria-label="Close"
              title="Close"
            >
              <X size={22} />
            </DialogPrimitive.Close>
          </div>
          <div
            ref={stage}
            className={`viewer-stage${zoomed ? ' zoomed' : ''}`}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
          >
            <div ref={frame} className="viewer-frame">
              {shot?.url && failed !== shot.url && (
                <img
                  key={shot.url}
                  ref={img}
                  src={shot.url}
                  alt={`Screenshot ${i + 1} of ${shots.length}`}
                  draggable={false}
                  className={loaded === shot.url ? 'ready' : ''}
                  onLoad={() => setLoaded(shot.url ?? '')}
                  onError={() => setFailed(shot.url ?? '')}
                />
              )}
              {shot?.url && failed === shot.url && (
                <p className="viewer-note">
                  This screenshot could not be loaded.
                </p>
              )}
              {(!shot?.url || (loaded !== shot.url && failed !== shot.url)) && (
                <LoaderCircle className="viewer-spinner spin" size={28} />
              )}
            </div>
          </div>
          {many && (
            <>
              <button
                type="button"
                className="viewer-arrow prev"
                aria-label="Previous screenshot"
                disabled={i === 0}
                onClick={() => go(i - 1)}
              >
                <ChevronLeft size={26} />
              </button>
              <button
                type="button"
                className="viewer-arrow next"
                aria-label="Next screenshot"
                disabled={i === shots.length - 1}
                onClick={() => go(i + 1)}
              >
                <ChevronRight size={26} />
              </button>
              <div className="viewer-dots" aria-hidden="true">
                {shots.map((_, j) => (
                  <i key={j} className={j === i ? 'on' : ''} />
                ))}
              </div>
            </>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
