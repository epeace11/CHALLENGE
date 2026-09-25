'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { loadChallenge } from '@/lib/api';
import { emptyData, type Data } from '@/lib/types';

/**
 * Loads the challenge for the signed-in user and keeps it fresh: every minute, on
 * window focus, and within a moment of any database change (Supabase Realtime).
 */
export function useChallengeData(uid: string | undefined) {
  const [data, setData] = useState<Data>(emptyData),
    [finalized, setFinalized] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  // Keyed on the user id, not the session object: token renewals must not restart the polling loop or trigger extra loads.
  const refresh = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const loaded = await loadChallenge();
      setData(loaded.data);
      setFinalized(loaded.finalized);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : ((e as { message: string }).message ??
              'Could not load the challenge. Try again.'),
      );
    } finally {
      setLoading(false);
    }
  }, [uid]);
  useEffect(() => {
    // Loading is external state: the first load starts as soon as the user is known.
    // oxlint-disable-next-line react/react-compiler
    void refresh();
    const id = setInterval(() => void refresh(), 60000);
    const focus = () => void refresh();
    window.addEventListener('focus', focus);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', focus);
    };
  }, [refresh]);
  // Live updates: any row change the database publishes (entries, points, reviews, journal) triggers one debounced reload.
  useEffect(() => {
    if (!uid) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel('challenge-live')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => void refresh(), 250);
      })
      .subscribe();
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [uid, refresh]);
  return { data, finalized, loading, error, setError, refresh };
}
