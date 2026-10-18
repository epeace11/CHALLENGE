import type { Metadata } from 'next';
import { LiveApp } from '@/components/live/live-app';

export const metadata: Metadata = {
  title: 'The Challenge',
  description:
    'A challenge for two: check in every day, review each other, and settle up with a gift.',
};

/** The Challenge for any couple, on the PROD CHALLENGE database. Not linked from anywhere yet. */
export default function AppPage() {
  return <LiveApp />;
}
