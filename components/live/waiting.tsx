'use client';
import { useEffect, useState } from 'react';
import {
  Check,
  CirclePlay,
  Copy,
  PencilLine,
  RotateCw,
  Send,
} from 'lucide-react';
import type { World } from '@/lib/next/model';
import type { Host } from '@/components/next/backend';
import { AccountMenu, PlainFrame } from '@/components/next/frames';
import { useNav } from '@/components/next/nav';
import { ActionBar, Button, GlassCard, PageTitle } from '@/components/next/ui';

/**
 * After setup, for the person who set it up, while the partner has no account yet: send the invite
 * link, and whether the partner has opened it. One main action: Send the link. (Once they're in,
 * Your challenges shows who it waits for.) A practice day fills the wait.
 */
export function Waiting({ world, host }: { world: World; host: Host }) {
  const { navigate } = useNav();
  const partner = world.partner.name;
  // Copying says so on the Copy button for a moment.
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);
  const joined = !world.partnerPending;
  const [invite, setInvite] = useState<{ link: string; code: string } | null>(
    null,
  );
  /** Making the link failed: say so, with Try again (and again by itself once back online). */
  const [failed, setFailed] = useState(false);
  /** Bumped by Try again, to ask for the link once more. */
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (joined) return;
    let gone = false;
    void host.inviteLink().then((i) => {
      if (gone) return;
      setInvite(i);
      setFailed(!i);
    });
    return () => {
      gone = true;
    };
  }, [host, joined, tries]);
  const retry = () => {
    setFailed(false);
    setTries((n) => n + 1);
  };
  useEffect(() => {
    if (!failed) return;
    const online = () => {
      setFailed(false);
      setTries((n) => n + 1);
    };
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, [failed]);

  const share = async () => {
    if (!invite) return;
    const text = `Join me in ${world.challenge.name}: ${invite.link}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: world.challenge.name, text });
        return;
      } catch {
        // Cancelled, or sharing is not allowed here: copy instead.
      }
    }
    await navigator.clipboard.writeText(invite.link);
    setCopied(true);
  };

  return (
    <PlainFrame aside={<AccountMenu cancel />}>
      <div className="flex flex-col gap-6 pb-6">
        <PageTitle
          title={`Invite ${partner}`}
          detail="Send this link. It works for 7 days."
        />
        <GlassCard className="flex flex-col gap-4">
          {failed ? (
            <p className="text-nx-body text-nx-ink" role="alert">
              Couldn’t make the link
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              <p className="text-nx-body break-all text-nx-ink">
                {invite?.link ?? 'Making your link…'}
              </p>
              {invite && (
                <p className="text-nx-2 text-nx-ink-2">
                  {world.invite.status === 'opened'
                    ? 'Opened'
                    : 'Not opened yet'}
                </p>
              )}
            </div>
          )}
          {failed ? (
            <Button icon={RotateCw} onClick={retry}>
              Try again
            </Button>
          ) : (
            <Button
              icon={copied ? Check : Copy}
              disabled={!invite}
              onClick={async () => {
                if (!invite) return;
                await navigator.clipboard.writeText(invite.link);
                setCopied(true);
              }}
            >
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          )}
        </GlassCard>
        <div className="flex flex-col items-start">
          <Button
            variant="quiet"
            icon={PencilLine}
            className="-ml-3"
            onClick={() => navigate('setup')}
          >
            Change the setup
          </Button>
          <Button
            variant="quiet"
            icon={CirclePlay}
            className="-ml-3"
            onClick={() => navigate('practice')}
          >
            Try a practice day
          </Button>
        </div>
      </div>
      <ActionBar>
        <Button
          variant="primary"
          size="lg"
          full
          icon={Send}
          disabled={!invite}
          onClick={share}
        >
          Send the link
        </Button>
      </ActionBar>
    </PlainFrame>
  );
}
