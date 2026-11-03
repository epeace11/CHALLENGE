'use client';
import { Link2Off } from 'lucide-react';
import { PlainFrame } from '@/components/next/frames';
import { useNav } from '@/components/next/nav';
import { setSignupMode } from '@/components/next/pages/signup/mode';
import { Button, EmptyState } from '@/components/next/ui';

/**
 * An invite link that expired or was already used (the host has forgotten it). Signed out: Sign in,
 * or start a challenge of their own from the landing page. Signed in: on to their own challenge.
 * Any navigation leaves this screen.
 */
export function InviteGone({ signedIn }: { signedIn: boolean }) {
  const { navigate } = useNav();
  return (
    <PlainFrame center brandTo={signedIn ? 'home' : 'landing'}>
      <EmptyState
        icon={Link2Off}
        title="This invite link has expired or was already used"
        action={
          signedIn ? (
            <Button variant="primary" size="lg" onClick={() => navigate(null)}>
              Continue
            </Button>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Button
                variant="primary"
                size="lg"
                onClick={() => {
                  setSignupMode('signin');
                  navigate('signup');
                }}
              >
                Sign in
              </Button>
              <Button variant="quiet" onClick={() => navigate('landing')}>
                Start your own challenge
              </Button>
            </div>
          )
        }
      >
        Ask your partner to send a new one.
      </EmptyState>
    </PlainFrame>
  );
}
