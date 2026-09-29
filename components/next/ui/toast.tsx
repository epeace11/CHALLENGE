'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from './button';
import { usePortalContainer } from './root';

type ToastInput =
  | string
  | {
      text: ReactNode;
      /** One action, such as Undo. */
      action?: { label: string; onClick: () => void };
      /** Milliseconds on screen; 4 s, or 6 s with an action. */
      duration?: number;
    };

type Toast = {
  id: number;
  text: ReactNode;
  action?: { label: string; onClick: () => void };
  duration: number;
};

const ToastContext = createContext<(t: ToastInput) => void>(() => {});

/**
 * Shows a short confirmation above the tab bar: `toast('Saved')`, or
 * `toast({ text: 'Approved', action: { label: 'Undo', onClick: undo } })`. Toasts confirm; they
 * never carry information that is not also on the page.
 */
export const useToast = () => useContext(ToastContext);

let nextId = 0;

/** NxRoot already provides this. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const container = usePortalContainer();
  const show = useCallback((input: ToastInput) => {
    const t = typeof input === 'string' ? { text: input } : input;
    const toast: Toast = {
      id: ++nextId,
      text: t.text,
      action: t.action,
      duration: t.duration ?? (t.action ? 6000 : 4000),
    };
    // One at a time: a newer toast replaces the older one, so an older Undo can never take back a
    // later change (useDemo's undo always reverts the latest).
    setToasts([toast]);
  }, []);
  const dismiss = useCallback(
    (id: number) => setToasts((list) => list.filter((t) => t.id !== id)),
    [],
  );
  return (
    <ToastContext.Provider value={show}>
      {children}
      {container &&
        createPortal(
          <div className="nx-toasts" aria-live="polite">
            <AnimatePresence initial={false}>
              {toasts.map((t) => (
                <ToastItem key={t.id} toast={t} dismiss={dismiss} />
              ))}
            </AnimatePresence>
          </div>,
          container,
        )}
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  dismiss,
}: {
  toast: Toast;
  dismiss: (id: number) => void;
}) {
  const still = useReducedMotion();
  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, dismiss]);
  return (
    <motion.div
      layout
      className="nx-toast"
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={{ duration: still ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      <output className="nx-toast-text">{toast.text}</output>
      {toast.action && (
        <Button
          variant="quiet"
          onClick={() => {
            toast.action?.onClick();
            dismiss(toast.id);
          }}
        >
          {toast.action.label}
        </Button>
      )}
    </motion.div>
  );
}
