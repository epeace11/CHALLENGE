// Why a button can't act yet, said next to it and on the field it is about.
'use client';
import {
  useId,
  useLayoutEffect,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { cn } from '@/lib/utils';

/**
 * Why a button can't act yet, next to it (Save, Send late answer, Add note). It is a status region,
 * so a screen reader hears it appear; empty, it takes no space.
 */
export function WhyLine({
  id,
  children,
  className,
}: {
  id: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <output
      id={id}
      className={cn(
        'block text-nx-2 font-semibold text-nx-wait empty:hidden',
        className,
      )}
    >
      {children}
    </output>
  );
}

/**
 * While `on`, the controls `find` returns are described by the message `id` and marked invalid, so
 * a screen reader hears why on the field focus moves to, not only in the bar. The kit's fields take
 * no aria props of their own, so this sets them on the elements, after every render.
 */
export function useDescribedBy(
  id: string,
  on: boolean,
  find: () => HTMLElement[],
) {
  useLayoutEffect(() => {
    if (!on) return;
    const controls = find();
    for (const el of controls) {
      const ids = describers(el);
      if (!ids.includes(id))
        el.setAttribute('aria-describedby', [...ids, id].join(' '));
      el.setAttribute('aria-invalid', 'true');
    }
    return () => {
      for (const el of controls) {
        const ids = describers(el).filter((x) => x !== id);
        if (ids.length) el.setAttribute('aria-describedby', ids.join(' '));
        else el.removeAttribute('aria-describedby');
        el.removeAttribute('aria-invalid');
      }
    };
  });
}

const describers = (el: HTMLElement) =>
  (el.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean);

/**
 * A button that stays filled and pressable while there is nothing to act on, like Check in's Save:
 * pressing it then says `problem` next to it and focuses the field inside `box`. Pass the button's
 * action to `press`.
 */
export function useWhy(
  problem: string | null,
  box: RefObject<HTMLElement | null>,
) {
  const id = useId();
  const [tried, setTried] = useState(false);
  const why = tried ? problem : null;
  const fields = () => [
    ...(box.current?.querySelectorAll<HTMLElement>('input, textarea') ?? []),
  ];
  useDescribedBy(id, !!why, fields);
  return {
    id,
    why,
    /** Does `act` when nothing is missing; else says why and focuses the field. */
    press: (act: () => void) => {
      if (!problem) {
        setTried(false);
        act();
        return;
      }
      setTried(true);
      fields()[0]?.focus();
    },
    /** Forgets the press (the field closed or was emptied by a save). */
    reset: () => setTried(false),
  };
}
