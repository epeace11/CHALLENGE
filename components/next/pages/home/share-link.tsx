'use client';
import { Copy } from 'lucide-react';
import type { SavedChallenge } from '@/lib/next/model';
import { setShareLink } from '@/lib/next/actions';
import { useDemo } from '@/components/next/world';
import {
  Button,
  Presence,
  Toggle,
  motion,
  useReducedMotion,
  useToast,
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
  const { update } = useDemo();
  const toast = useToast();
  const still = useReducedMotion();
  return (
    <div className="flex flex-col">
      <Toggle
        checked={saved.linkOn}
        onChange={(on) => update((w) => setShareLink(w, saved.id, on))}
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
                icon={Copy}
                onClick={async () => {
                  const copied = await copyText(saved.link);
                  toast(
                    copied
                      ? 'Link copied'
                      : 'Could not copy. Select the link and copy it.',
                  );
                }}
              >
                Copy link
              </Button>
            </div>
          </motion.div>
        )}
      </Presence>
    </div>
  );
}
