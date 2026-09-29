'use client';
import { useEffect, useState } from 'react';
import type { World } from '@/lib/next/model';
import { useNav } from '@/components/next/nav';
import { useToast } from '@/components/next/ui';
import { exportFile } from './data';

/* ── Appearance ────────────────────────────────────────────────────────── */

export type ThemeChoice = 'light' | 'dark' | 'system';

export const THEME_OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Match phone' },
];

const readChoice = (): ThemeChoice => {
  try {
    const t = localStorage.getItem('theme');
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
};

/**
 * Light, dark or matching the phone, on <html data-theme> and in localStorage 'theme', the same
 * places the preview's moon button and today's app use, so they stay in step.
 */
export function useThemeChoice() {
  const [choice, setChoice] = useState<ThemeChoice>('system');
  useEffect(() => {
    const read = () => setChoice(readChoice());
    read();
    const watch = new MutationObserver(read);
    watch.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => watch.disconnect();
  }, []);
  const choose = (next: ThemeChoice) => {
    try {
      if (next === 'system') localStorage.removeItem('theme');
      else localStorage.setItem('theme', next);
    } catch {}
    const theme =
      next === 'system'
        ? matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : next;
    setChoice(next);
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name=theme-color]')
      ?.setAttribute('content', theme === 'dark' ? '#0d0b14' : '#f6f8fb');
  };
  return [choice, choose] as const;
}

/* ── Leaving, signing out, deleting, exporting ─────────────────────────── */

/** Sends a text file to the viewer's downloads. Nothing goes over the network. */
function download(filename: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The account's actions, each doing exactly what its button says. */
export function useAccount(world: World) {
  const { navigate } = useNav();
  const toast = useToast();
  return {
    exportData: () => {
      const file = exportFile(world);
      download(file.filename, file.text);
      toast(`Downloaded ${file.filename}`);
    },
    signOut: () => {
      toast('Signed out');
      navigate('signup');
    },
    leave: () => {
      toast(`You left ${world.challenge.name}`);
      navigate('home');
    },
    deleteAccount: () => {
      toast('Account deleted');
      navigate('landing');
    },
  };
}
