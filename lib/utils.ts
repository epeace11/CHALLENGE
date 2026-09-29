import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge that knows the new UI's type scale (styles/next.css): without it, text-nx-2 (a
 * size) and text-nx-ink-2 (a colour) look like the same kind of class and one of them is dropped.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        'nx-min',
        'nx-2',
        'nx-body',
        'nx-lead',
        'nx-h3',
        'nx-h2',
        'nx-h1',
        'nx-num',
        'nx-num-lg',
        'nx-num-xl',
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
