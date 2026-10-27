'use client';
import { useEffect, useState } from 'react';
import { Copy, PencilLine, Send } from 'lucide-react';
import type { World } from '@/lib/next/model';
import type { Host } from '@/components/next/backend';
import { AccountMenu, PlainFrame } from '@/components/next/frames';
import { useNav } from '@/components/next/nav';
import {
  ActionBar,
  Button,
  GlassCard,
  PageTitle,
  useToast,
} from '@/components/next/ui';

/**
 * After setup, for the person who set it up, while the partner has no account yet: send the invite
 * link. One main action: Send the link. (Once they're in, Your challenges shows who it waits for.)
 */
export function Waiting({ world, host }: { world: World; host: Host }) {
  const { navigate } = useNav();
  const toast = useToast();
  const partner = world.partner.name;
  const joined = !world.partnerPending;
  const [invite, setInvite] = useState<{ link: string; code: string } | null>(
    null,
  );
  useEffect(() => {
    if (joined) return;
    let gone = false;
    void host.inviteLink().then((i) => !gone && setInvite(i));
    return () => {
      gone = true;
    };
  }, [host, joined]);

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
    toast('Link copied');
  };

  return (
    <PlainFrame aside={<AccountMenu cancel />}>
      <div className="flex flex-col gap-6 pb-6">
        <PageTitle
          title={`Invite ${partner}`}
          detail="Send this link. It works for 7 days."
        />
        <GlassCard className="flex flex-col gap-4">
          <p className="text-nx-body break-all text-nx-ink">
            {invite?.link ?? 'Making your link…'}
          </p>
          <Button
            icon={Copy}
            disabled={!invite}
            onClick={async () => {
              if (!invite) return;
              await navigator.clipboard.writeText(invite.link);
              toast('Link copied');
            }}
          >
            Copy link
          </Button>
        </GlassCard>
        <Button
          variant="quiet"
          icon={PencilLine}
          className="-ml-3 self-start"
          onClick={() => navigate('setup')}
        >
          Change the setup
        </Button>
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
