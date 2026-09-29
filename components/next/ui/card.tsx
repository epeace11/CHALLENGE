'use client';
import type { ComponentProps, HTMLAttributes, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type Pad = 'none' | 'sm' | 'md' | 'lg';
const PAD: Record<Pad, string> = {
  none: '',
  sm: 'nx-pad-sm',
  md: 'nx-pad',
  lg: 'nx-pad-lg',
};

type CardProps = HTMLAttributes<HTMLElement> & {
  /** Inner padding: sm 14/16px, md 20px (24px from 640px), lg 24px (32px). Default md. */
  pad?: Pad;
  /** Render as a section, article or list item instead of a div. */
  as?: 'div' | 'section' | 'article' | 'li';
};

/** A frosted glass card: the main surface of the new UI. */
export function GlassCard({
  pad = 'md',
  as = 'div',
  className,
  ...rest
}: CardProps) {
  const Tag = as as 'div';
  return <Tag className={cn('nx-glass', PAD[pad], className)} {...rest} />;
}

/** A plain surface with a hairline border, for groups inside a glass card or quieter lists. */
export function Card({
  pad = 'md',
  as = 'div',
  className,
  ...rest
}: CardProps) {
  const Tag = as as 'div';
  return <Tag className={cn('nx-card', PAD[pad], className)} {...rest} />;
}

/**
 * A whole glass card that is one button, with a chevron so it reads as tappable. Put anything
 * inside; it must say where it goes.
 */
export function TapCard({
  pad = 'md',
  chevron = true,
  className,
  children,
  type = 'button',
  ...rest
}: ComponentProps<'button'> & { pad?: Pad; chevron?: boolean }) {
  return (
    <button
      type={type}
      className={cn(
        'nx-glass nx-tappable relative items-start gap-4',
        PAD[pad],
        className,
      )}
      {...rest}
    >
      <span className="min-w-0 flex-1">{children}</span>
      {chevron && (
        <ChevronRight
          className="nx-row-chevron mt-0.5"
          size={22}
          aria-hidden="true"
        />
      )}
    </button>
  );
}

/**
 * A big tappable row: an optional leading icon or avatar, a title, a detail line, an optional
 * trailing value (on the right from 640px, under the detail on phones), and a chevron. At least
 * 60px tall. Use for lists that open something.
 */
export function RowButton({
  title,
  detail,
  leading,
  trailing,
  chevron = true,
  glass = true,
  className,
  type = 'button',
  ...rest
}: Omit<ComponentProps<'button'>, 'title'> & {
  title: ReactNode;
  detail?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  chevron?: boolean;
  /** Glass card (default) or a plain card. */
  glass?: boolean;
}) {
  return (
    <button
      type={type}
      className={cn(
        glass ? 'nx-glass' : 'nx-card',
        'nx-tappable nx-row',
        className,
      )}
      {...rest}
    >
      {leading && <span className="flex shrink-0 items-center">{leading}</span>}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-nx-body font-semibold text-nx-ink">{title}</span>
        {detail && <span className="text-nx-2 text-nx-ink-2">{detail}</span>}
        {/* On phones the trailing value goes under the text, so the title keeps its width. */}
        {trailing && (
          <span className="mt-1.5 self-start text-nx-body text-nx-ink-2 sm:hidden">
            {trailing}
          </span>
        )}
      </span>
      {trailing && (
        <span className="hidden shrink-0 text-nx-body text-nx-ink-2 sm:block">
          {trailing}
        </span>
      )}
      {chevron && (
        <ChevronRight className="nx-row-chevron" size={22} aria-hidden="true" />
      )}
    </button>
  );
}
