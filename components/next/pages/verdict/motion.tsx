'use client';
import { useEffect, useState, type CSSProperties } from 'react';
import { CountUp, useReducedMotion } from '@/components/next/ui';
import { formatMoney } from '@/lib/next/selectors';
import styles from './verdict.module.css';

/** Where each piece of the burst lands, and its colour. Fixed, so the burst looks the same every time. */
const PIECES: { x: number; y: number; r: number; c: string }[] = [
  { x: -54, y: -34, r: 160, c: 'var(--nx-accent)' },
  { x: -30, y: -58, r: -90, c: 'var(--nx-done-bar)' },
  { x: 4, y: -64, r: 220, c: 'var(--nx-wait-bar)' },
  { x: 36, y: -54, r: -140, c: 'var(--nx-missed-bar)' },
  { x: 58, y: -26, r: 90, c: 'var(--nx-accent)' },
  { x: 62, y: 8, r: -200, c: 'var(--nx-done-bar)' },
  { x: 40, y: 34, r: 130, c: 'var(--nx-wait-bar)' },
  { x: -8, y: 42, r: -60, c: 'var(--nx-accent)' },
  { x: -44, y: 30, r: 200, c: 'var(--nx-missed-bar)' },
  { x: -64, y: 2, r: -170, c: 'var(--nx-done-bar)' },
];

/** A small celebration: confetti bursting from the middle of the parent, once, in 300 ms. Decorative. */
export function Burst() {
  return (
    <span className={styles.burst} aria-hidden="true">
      {PIECES.map((p, i) => (
        <i
          key={i}
          style={
            {
              '--x': `${p.x}px`,
              '--y': `${p.y}px`,
              '--r': `${p.r}deg`,
              '--c': p.c,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}

/**
 * A gift's amount, revealed: it shows $0 until `delay` ms have passed (while its card fades in), then
 * counts up to the amount. Screen readers hear only the amount. Under reduced motion it shows the
 * amount at once.
 */
export function RevealAmount({
  amount,
  delay = 0,
}: {
  amount: number;
  delay?: number;
}) {
  const still = useReducedMotion();
  const [started, setStarted] = useState(false);
  // Reduced motion only shortens the wait, so the first render always matches the server's.
  useEffect(() => {
    const timer = setTimeout(() => setStarted(true), still ? 0 : delay);
    return () => clearTimeout(timer);
  }, [delay, still]);
  if (started) return <CountUp value={amount} format={formatMoney} />;
  return (
    <>
      <span className="sr-only">{formatMoney(amount)}</span>
      <span aria-hidden="true">{formatMoney(0)}</span>
    </>
  );
}
