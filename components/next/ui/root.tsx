'use client';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { LazyMotion, MotionConfig } from 'motion/react';
import type { Look } from '@/lib/next/model';
import { cn } from '@/lib/utils';
import { ToastProvider } from './toast';

const PortalContext = createContext<HTMLElement | null>(null);

/**
 * Motion's animation features (layout animations included) are a chunk of their own, fetched as soon
 * as the kit loads instead of bundled with it. Until they arrive an animated element waits at its
 * starting state, so a failed fetch is tried once more.
 */
const loadFeatures = () => import('./motion-features').then((f) => f.default);
const features = loadFeatures().catch(loadFeatures);
const motionFeatures = () => features;

/** Where sheets, menus and toasts render: inside the .nx root, so they keep its tokens and look. */
export const usePortalContainer = () => useContext(PortalContext);

let hydrated = false;
/** False while the server-rendered page is being hydrated, true afterwards. CountUp skips its animation on first load. */
export const isHydrated = () => hydrated;

/**
 * Sets the browser's bar colour (`theme-color`) to the page colour of the look and theme on screen.
 * Call it after changing the theme; the root calls it when the look changes.
 */
export function syncThemeColor() {
  requestAnimationFrame(() => {
    const root = document.querySelector<HTMLElement>('.nx');
    const page =
      root && getComputedStyle(root).getPropertyValue('--nx-page').trim();
    if (page)
      document
        .querySelector('meta[name=theme-color]')
        ?.setAttribute('content', page);
  });
}

/**
 * The root of the new UI: the .nx element that scopes styles/next.css, its look, reduced-motion
 * handling for Motion, toasts, and the container that sheets and menus portal into. The preview
 * renders exactly one; pages never render another.
 */
export function NxRoot({
  look = 'classic',
  className,
  style,
  children,
}: {
  look?: Look;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  useEffect(() => {
    hydrated = true;
  }, []);
  useEffect(syncThemeColor, [look]);
  return (
    <div className={cn('nx', className)} data-look={look} style={style}>
      {/* strict: a full `motion` component here would load the features again, so it throws. */}
      <LazyMotion features={motionFeatures} strict>
        <MotionConfig
          reducedMotion="user"
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <PortalContext.Provider value={portal}>
            <ToastProvider>{children}</ToastProvider>
          </PortalContext.Provider>
        </MotionConfig>
      </LazyMotion>
      <div ref={setPortal} />
    </div>
  );
}
