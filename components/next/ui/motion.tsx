'use client';
import {
  Children,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { formatNumber } from '@/lib/next/format';
import { cn } from '@/lib/utils';
import { isHydrated } from './root';

/**
 * Motion helpers. Every animation here is 150–300 ms, ease-out, never blocks a tap, and is off
 * under prefers-reduced-motion. For anything else, use Motion directly (`motion`, `Presence`,
 * `layout`) with these durations and EASE; NxRoot's MotionConfig turns transform and layout
 * animations off under reduced motion.
 */

/** The ease-out curve for Motion (same as --nx-ease). */
export const EASE = [0.22, 1, 0.36, 1] as const;
/** Durations in seconds for Motion (the CSS tokens are --nx-fast, --nx-base, --nx-slow). */
export const DURATION = { fast: 0.15, base: 0.22, slow: 0.3 } as const;

export { AnimatePresence as Presence, motion, useReducedMotion };

/** Fades and lifts its content in once, on mount. `index` staggers siblings by 45 ms each. Pure CSS. */
export function Enter({
  index = 0,
  className,
  style,
  children,
  as: As = 'div',
}: {
  index?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  as?: 'div' | 'section' | 'li' | 'span';
}) {
  return (
    <As
      className={cn('nx-enter', className)}
      style={{ ...style, ['--nx-i' as string]: index }}
    >
      {children}
    </As>
  );
}

/**
 * Enters each child in turn. Each child is wrapped in a div (a li when `as` is 'ul' or 'ol'), so use
 * it where the children stack: a flex or grid column, or a list.
 */
export function Stagger({
  children,
  className,
  as: As = 'div',
  start = 0,
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'ul' | 'ol' | 'section';
  /** Index of the first child, to continue a stagger from an earlier block. */
  start?: number;
}) {
  const Item = As === 'ul' || As === 'ol' ? 'li' : 'div';
  return (
    <As className={className}>
      {Children.toArray(children).map((child, i) => (
        <Item
          key={i}
          className="nx-enter"
          style={{ ['--nx-i' as string]: start + i }}
        >
          {child}
        </Item>
      ))}
    </As>
  );
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A number that counts up to `value` (from 0 when it first appears, then from the old value when it
 * changes). Screen readers hear only the final value. On the first page load it just shows the value.
 */
export function CountUp({
  value,
  format = (n) => formatNumber(Math.round(n)),
  duration = 300,
}: {
  value: number;
  /** How to show the number: formatMoney, or (n) => `${Math.round(n)} days`. */
  format?: (n: number) => string;
  /** Milliseconds, 150–300. */
  duration?: number;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(() =>
    isHydrated() && !prefersReducedMotion() ? 0 : value,
  );
  const from = useRef(shown);
  useEffect(() => {
    const start = from.current,
      delta = value - start;
    if (delta === 0 || reduced) {
      from.current = value;
      return;
    }
    let frame = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration),
        v = start + delta * (1 - Math.pow(1 - p, 3));
      from.current = v;
      setShown(v);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduced]);
  return (
    <>
      <span className="sr-only">{format(value)}</span>
      <span aria-hidden="true">{format(reduced ? value : shown)}</span>
    </>
  );
}

/**
 * Swaps its content with a short slide when `id` changes: the old content glides out while the new
 * one glides in (a saved check-in moving on to the next). `direction` -1 goes backwards. The old
 * content is taken out of the layout at once, so nothing waits for it.
 */
export function Glide({
  id,
  direction = 1,
  className,
  children,
}: {
  id: string | number;
  direction?: 1 | -1;
  className?: string;
  children: ReactNode;
}) {
  const still = useReducedMotion();
  return (
    <div className={cn('relative', className)}>
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.div
          key={id}
          custom={direction}
          variants={{
            enter: (d: number) => ({ x: 32 * d, opacity: 0 }),
            center: { x: 0, opacity: 1 },
            exit: (d: number) => ({ x: -32 * d, opacity: 0 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: still ? 0 : DURATION.slow, ease: EASE }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/**
 * One item of a list that grows and shrinks: it fades in when added, fades out when removed, and
 * the rest slide into place. Wrap the list in `<Presence mode="popLayout" initial={false}>` inside
 * a `relative` container, and give each Item a stable key.
 */
export function Item({
  className,
  children,
  ref,
}: {
  className?: string;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}) {
  const still = useReducedMotion();
  return (
    <motion.div
      ref={ref}
      layout
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{
        opacity: 0,
        scale: 0.97,
        transition: { duration: still ? 0 : DURATION.fast },
      }}
      transition={{ duration: still ? 0 : DURATION.base, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
