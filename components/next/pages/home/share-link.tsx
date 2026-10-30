'use client';
import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { SavedChallenge } from '@/lib/next/model';
import { setShareLink } from '@/lib/next/actions';
import { useBackend } from '@/components/next/backend';
import {
  Button,
  Presence,
  Toggle,
  motion,
  useReducedMotion,
  DURATION,
  EASE,
} from '@/components/next/ui';
import { copyText, shortLink } from './helpers';
import styles from './home.module.css';

/**
 * A saved challenge's share link: a switch, and while it is on, the link with Copy link. The link
 * slides open and closed.
 */
export function ShareLink({ saved }: { saved: SavedChallenge }) {
  const backend = useBackend();
  const still = useReducedMotion();
  // Copying says so on the button for a moment; if the browser refuses, a line says what to do.
  const [copied, setCopied] = useState<boolean | null>(null);
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(null), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);
  return (
    <div className="flex flex-col">
      <Toggle
        checked={saved.linkOn}
        onChange={(on) =>
          backend.act({ type: 'setShareLink', savedId: saved.id, on }, (w) =>
            setShareLink(w, saved.id, on),
          )
        }
        label="Share link"
        description="Lets other couples start their own copy."
      />
      <Presence initial={false}>
        {saved.linkOn && (
          <motion.div
            key="link"
            className="-mx-1.5 overflow-hidden px-1.5"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: still ? 0 : DURATION.base, ease: EASE }}
          >
            <div className="flex flex-col gap-3 pt-1.5 pb-2 sm:flex-row sm:items-center">
              <p className={styles.link} title={saved.link}>
                {shortLink(saved.link)}
              </p>
              <Button
                icon={copied ? Check : Copy}
                onClick={async () => setCopied(await copyText(saved.link))}
              >
                {copied ? 'Copied' : 'Copy link'}
              </Button>
            </div>
            {copied === false && (
              <p className="pb-2 text-nx-2 text-nx-ink-2">
                Couldn’t copy. Select the link and copy it.
              </p>
            )}
          </motion.div>
        )}
      </Presence>
    </div>
  );
}
