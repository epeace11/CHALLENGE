'use client';
import { useState } from 'react';
import { ChevronDown, LayoutGrid, LogOut, X } from 'lucide-react';
import { useBackend } from '@/components/next/backend';
import { useNav } from '@/components/next/nav';
import { Button } from '@/components/next/ui/button';
import { Menu, type MenuItem } from '@/components/next/ui/menu';
import { Avatar } from '@/components/next/ui/people';
import { Sheet } from '@/components/next/ui/sheet';
import { useWorld } from '@/components/next/world';

/**
 * The viewer's name at the top right of the pages before Day 1 (Start, Set up, the invite, the
 * pact), opening Your challenges, Sign out and, with `cancel`, Cancel this challenge. Cancelling asks first, then
 * deletes the challenge for both people.
 */
export function AccountMenu({ cancel }: { cancel?: boolean }) {
  const world = useWorld();
  const { host } = useBackend();
  const { navigate } = useNav();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const you = world.me;
  const partner = world.partnerPending ? null : world.partner.name;

  const items: MenuItem[] = [
    {
      label: 'Your challenges',
      icon: LayoutGrid,
      onSelect: () => navigate('home'),
    },
    {
      label: 'Sign out',
      icon: LogOut,
      onSelect: () => {
        if (host) return void host.signOut();
        navigate('landing');
      },
    },
  ];
  if (cancel)
    items.splice(1, 0, {
      label: 'Cancel this challenge',
      icon: X,
      onSelect: () => setAsking(true),
    });

  const confirm = async () => {
    if (!host) {
      setAsking(false);
      return navigate('start');
    }
    setBusy(true);
    const ok = await host.cancelChallenge();
    setBusy(false);
    if (ok) setAsking(false);
  };

  return (
    <>
      <Menu
        align="end"
        trigger={
          <button
            type="button"
            className="nx-chip nx-press hover:border-nx-accent-line"
            aria-label={`Signed in as ${you.name}. Account`}
          >
            <Avatar person={you} size="sm" decorative />
            <span>{you.name}</span>
            <ChevronDown
              size={16}
              aria-hidden="true"
              className="-ml-1 text-nx-ink-2"
            />
          </button>
        }
        items={items}
      />
      {cancel && (
        <Sheet
          open={asking}
          onOpenChange={setAsking}
          title={`Cancel ${world.challenge.name}?`}
          description={
            partner
              ? `It’s deleted for you and ${partner}, with its rules and signatures. This can’t be undone.`
              : 'It’s deleted with its rules, and the invite link stops working. This can’t be undone.'
          }
          footer={
            <>
              <Button onClick={() => setAsking(false)}>Keep it</Button>
              <Button
                variant="danger"
                icon={X}
                loading={busy}
                onClick={() => void confirm()}
              >
                Cancel challenge
              </Button>
            </>
          }
        />
      )}
    </>
  );
}
