'use client';
import { useEffect, useState } from 'react';

/** The current time, updated every 30 seconds so countdowns and deadlines stay current. */
export function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  return now;
}
