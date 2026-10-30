// The verdict's state (marking gifts, Run it again, Save as), its wording, and the pieces it shows.
'use client';
import { useState } from 'react';
import {
  BookmarkPlus,
  Gift as GiftIcon,
  MessagesSquare,
  Trophy,
} from 'lucide-react';
import { PlainFrame } from '@/components/next/frames';
import { useNav } from '@/components/next/nav';
import { useBackend } from '@/components/next/backend';
import { useWorld } from '@/components/next/world';
import {
  Avatar,
  Button,
  EmptyState,
  GlassCard,
  RowButton,
} from '@/components/next/ui';
import { plural } from '@/lib/next/selectors';
import {
  giftsOf,
  markGift,
  saveAs,
  suggestName,
  verdictOf,
  type Gift,
  type VerdictView,
} from './data';
import {
  BadgesSheet,
  GiftsSheet,
  SaveSheet,
  StreaksSheet,
  type VerdictSheet,
} from './sheets';
import styles from './verdict.module.css';
import { pastToShow } from './which';

/**
 * The verdict's state, as v1 keeps it: which gifts are marked (saved with the challenge in the live
 * app), the burst for the one just marked, the open sheet, Run it again and Save as. Nothing pops up:
 * each change shows where it was made. The gifts come in the order you deal with them: the one you
 * give first, then the one you get.
 */
export function useVerdictPage() {
  const world = useWorld();
  const shownPast = pastToShow(world);
  const { navigate } = useNav();
  const backend = useBackend();
  // Which gifts are marked given, by who receives them.
  const [given, setGiven] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      (shownPast?.verdict.people ?? []).map((p) => [
        p.personId,
        !!p.giftGivenAt,
      ]),
    ),
  );
  // The gift just marked, and a count so its burst plays again each time.
  const [burst, setBurst] = useState<{ id: string; n: number } | null>(null);
  const [sheet, setSheet] = useState<VerdictSheet>(null);
  const v = verdictOf(world, shownPast);

  /** A new challenge with the same rules and stakes (the live app), or Set up (the preview). */
  const runAgain = () =>
    v && backend.host
      ? void backend.host.startFrom({
          kind: 'again',
          challenge: v.past.challenge,
        })
      : navigate('setup');

  // The gift you give comes first: marking it is yours to do; the one you get you only confirm.
  const gifts = v
    ? giftsOf(v).sort((a, b) => Number(b.from.isMe) - Number(a.from.isMe))
    : [];
  const next = gifts.find((g) => !given[g.id]);

  const setOne = (id: string, value: boolean) => {
    if (!v) return;
    setGiven((s) => ({ ...s, [id]: value }));
    backend.act(
      {
        type: 'markGift',
        challengeId: v.past.challenge.id,
        recipientId: id,
        given: value,
      },
      (w) => markGift(w, v.past.challenge.id, id, value ? w.now : null),
    );
  };
  /** Marks a gift given (or received), with its burst. The card then says so, and can mark it back. */
  const mark = (g: Gift) => {
    setOne(g.id, true);
    setBurst((b) => ({ id: g.id, n: (b?.n ?? 0) + 1 }));
  };
  const unmark = (g: Gift) => setOne(g.id, false);

  // Disputes still open on this challenge; Review settles them only while it's the one loaded.
  const openDisputes =
    v && (!backend.host || world.challenge.id === v.past.challenge.id)
      ? (v.past.verdict.openDisputes ?? 0)
      : 0;

  const save = (name: string) => {
    if (!v) return;
    backend.act(
      { type: 'saveAs', challengeId: v.past.challenge.id, name: name.trim() },
      (w) => saveAs(w, v.past, name),
    );
  };

  return {
    world,
    v,
    navigate,
    gifts,
    given,
    next,
    mark,
    unmark,
    burst,
    sheet,
    setSheet,
    runAgain,
    openDisputes,
    save,
  };
}

export type VerdictPage = ReturnType<typeof useVerdictPage>;

/* ── Wording ─────────────────────────────────────────────────────────────── */

/** "Jordan’s" */
export const possessive = (name: string) => `${name}’s`;

/** Who won, for the viewer: 'me', 'partner' or 'tie'. */
export const outcome = (v: VerdictView) =>
  v.winner === null ? 'tie' : v.winner === v.me.person.id ? 'me' : 'partner';

/** "You 21 days, Jordan 12": each person's best streak. */
export const streakLine = (v: VerdictView) =>
  `You ${plural(v.me.streak.days, 'day')}, ${v.partner.person.name} ${v.partner.streak.days}`;

/** "You 7, Jordan 3": how many badges each person earned. */
export const badgeLine = (v: VerdictView) =>
  `You ${v.me.badges.length}, ${v.partner.person.name} ${v.partner.badges.length}`;

/* ── Pieces ──────────────────────────────────────────────────────────────── */

/** No finished challenge yet: the way back to Your challenges. */
export function NoVerdict() {
  const { navigate } = useNav();
  return (
    <PlainFrame back={{ to: 'home', label: 'Your challenges' }}>
      <GlassCard pad="lg" className="mt-6">
        <EmptyState
          icon={Trophy}
          title="No finished challenge yet"
          action={
            <Button variant="primary" onClick={() => navigate('home')}>
              Back to Your challenges
            </Button>
          }
        />
      </GlassCard>
    </PlainFrame>
  );
}

/** Save as… in the top bar. */
export function SaveAsButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="quiet" icon={BookmarkPlus} onClick={onClick}>
      Save as…
    </Button>
  );
}

/** "1 dispute is still open", which opens Review. */
export function OpenDisputesRow({
  count,
  onOpen,
  className,
}: {
  count: number;
  onOpen: () => void;
  className?: string;
}) {
  return (
    <RowButton
      className={className}
      leading={
        <span className="grid size-11 place-items-center rounded-full bg-nx-accent-soft text-nx-accent">
          <MessagesSquare size={20} aria-hidden="true" />
        </span>
      }
      title={`${plural(count, 'dispute')} ${count === 1 ? 'is' : 'are'} still open`}
      detail={
        count === 1
          ? 'Not a point unless it’s conceded. If it is, the gifts change.'
          : 'None is a point unless it’s conceded. If one is, the gifts change.'
      }
      onClick={onOpen}
    />
  );
}

/**
 * The gift changing hands: the giver's avatar, the gift, and the avatar of the one who gets it. The
 * gift waits by the giver and slides across once it's marked. Decorative; the words beside it say it.
 */
export function HandOff({
  gift: g,
  done,
  size = 'md',
}: {
  gift: Gift;
  done: boolean;
  size?: 'md' | 'lg';
}) {
  return (
    <span
      className={styles.handoff}
      data-done={done || undefined}
      data-size={size}
      aria-hidden="true"
    >
      <Avatar person={g.from.person} size={size} decorative />
      <span className={styles.track}>
        <span className={styles.parcel}>
          <GiftIcon size={size === 'lg' ? 20 : 17} strokeWidth={2.2} />
        </span>
      </span>
      <Avatar person={g.to.person} size={size} decorative />
    </span>
  );
}

/** Every sheet the verdict opens: how the gifts were set, best streaks, badges and Save as. */
export function VerdictSheets({ page }: { page: VerdictPage }) {
  const { v, sheet, setSheet, runAgain, world, save } = page;
  if (!v) return null;
  const close = (open: boolean) => {
    if (!open) setSheet(null);
  };
  return (
    <>
      <GiftsSheet v={v} open={sheet === 'gifts'} onOpenChange={close} />
      <StreaksSheet
        v={v}
        open={sheet === 'streaks'}
        onOpenChange={close}
        onRunAgain={runAgain}
      />
      <BadgesSheet v={v} open={sheet === 'badges'} onOpenChange={close} />
      <SaveSheet
        open={sheet === 'save'}
        onOpenChange={close}
        suggestion={suggestName(world, v.name)}
        taken={world.saved.map((s) => s.name)}
        onSave={save}
      />
    </>
  );
}
