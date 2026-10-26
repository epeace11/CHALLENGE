'use client';
import { useEffect } from 'react';

/** The home page opens the app, keeping any link's ?invite=, ?shared= or #… on the way. */
export default function Page() {
  useEffect(() => {
    location.replace(`/app${location.search}${location.hash}`);
  }, []);
  return null;
}
