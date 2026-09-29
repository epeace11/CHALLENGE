'use client';
import type { ReactElement } from 'react';
import { Menu as BaseMenu } from '@base-ui/react/menu';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePortalContainer } from './root';

export type MenuItem = {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  /** Marks the item for the page on screen. */
  current?: boolean;
};

/**
 * A short list of places or actions that opens from a button (the More tab). Items are 48px tall;
 * arrow keys, Enter and Escape work. `trigger` is the button element that opens it, for example
 * `<button className="nx-tab">…</button>` or `<Button>More</Button>`.
 */
export function Menu({
  trigger,
  items,
  side = 'bottom',
  align = 'end',
  className,
}: {
  trigger: ReactElement;
  items: MenuItem[];
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  className?: string;
}) {
  const container = usePortalContainer();
  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger render={trigger} />
      <BaseMenu.Portal container={container}>
        <BaseMenu.Positioner
          className="z-[70] outline-none"
          side={side}
          align={align}
          sideOffset={10}
          collisionPadding={12}
        >
          <BaseMenu.Popup className={cn('nx-menu', className)}>
            {items.map(({ label, icon: Icon, onSelect, current }) => (
              <BaseMenu.Item
                key={label}
                className="nx-menu-item"
                aria-current={current ? 'page' : undefined}
                onClick={onSelect}
              >
                {Icon && <Icon size={20} aria-hidden="true" />}
                {label}
              </BaseMenu.Item>
            ))}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}
