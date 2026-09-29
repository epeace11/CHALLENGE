/**
 * Joins class names without merging them. The shared cn() runs tailwind-merge, which reads
 * text-nx-2 (a size) and text-nx-ink-2 (a colour) as the same kind of class and drops one, so this
 * folder joins its own classes plainly.
 */
export const cx = (...classes: (string | false | null | undefined)[]) =>
  classes.filter(Boolean).join(' ');
