'use client';
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

/** The Supabase session, and whether the user arrived from a password-reset link. */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null),
    [ready, setReady] = useState(false),
    [recovery, setRecovery] = useState(false);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setReady(true);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
    });
    return () => subscription.unsubscribe();
  }, []);
  return { session, ready, recovery, endRecovery: () => setRecovery(false) };
}
