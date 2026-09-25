'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { loadChallenge } from '@/lib/api';
import { emptyData, type Data } from '@/lib/types';

/** Tables whose changes reload the app: the ones published to Realtime (supabase/setup.sql). */
const LIVE_TABLES = [
  'challenge_entries',
  'challenge_points',
  'challenge_requests',
  'challenge_disputes',
  'challenge_finalizations',
  'challenge_config',
  'challenge_journal_notes',
];

/**
 * Loads the challenge for the signed-in user and keeps it fresh: every minute, on
 * window focus, and within a moment of any database change (Supabase Realtime).
 */
export function useChallengeData(uid: string | undefined) {
  const [data, setData] = useState<Data>(emptyData),
    [finalized, setFinalized] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  // One load at a time. A request that arrives mid-load queues exactly one more, so overlapping
  // loads can never land out of order. A failed background load shows an error that the next
  // successful load clears; errors from the user's own actions are left for them to read.
  const inflight = useRef<Promise<void> | null>(null),
    queued = useRef<{ sync: boolean } | null>(null),
    loadFailed = useRef(false);
  // Keyed on the user id, not the session object: token renewals must not restart the polling loop or trigger extra loads.
  const refresh = useCallback(
    (sync = true) => {
      if (!uid) return Promise.resolve();
      if (inflight.current) {
        queued.current = { sync: sync || (queued.current?.sync ?? false) };
        return inflight.current;
      }
      inflight.current = (async () => {
        let next: { sync: boolean } | null = { sync };
        setLoading(true);
        while (next) {
          queued.current = null;
          try {
            const loaded = await loadChallenge(next.sync);
            setData(loaded.data);
            setFinalized(loaded.finalized);
            if (loadFailed.current) {
              loadFailed.current = false;
              setError('');
            }
          } catch (e) {
            loadFailed.current = true;
            setError(
              e instanceof Error
                ? e.message
                : ((e as { message: string }).message ??
                    'Could not load the challenge. Try again.'),
            );
          }
          next = queued.current;
        }
        setLoading(false);
        inflight.current = null;
      })();
      return inflight.current;
    },
    [uid],
  );
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
  // Live updates: any published row change (entries, points, reviews, journal) triggers one debounced
  // reload. The write that caused it already ran the deadline checks, so the reload skips them.
  useEffect(() => {
    if (!uid) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let channel = supabase.channel('challenge-live');
    for (const table of LIVE_TABLES)
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
          clearTimeout(timer);
          timer = setTimeout(() => void refresh(false), 250);
        },
      );
    channel.subscribe();
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [uid, refresh]);
  return { data, finalized, loading, error, setError, refresh };
}
