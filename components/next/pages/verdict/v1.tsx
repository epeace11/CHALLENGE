// Version 1: the two gifts are revealed first as big cards, each with its own button ("Mark gift as given", or "Mark as received" for yours); best streaks, badges and what next follow.
'use client';
import { useState, type CSSProperties } from 'react';
import {
  BookmarkPlus,
  Check,
  ChevronRight,
  Flame,
  Gift as GiftIcon,
  Plus,
  RotateCcw,
  Trophy,
} from 'lucide-react';
import { PlainFrame } from '@/components/next/frames';
import { useNav } from '@/components/next/nav';
import { useDemo, useWorld } from '@/components/next/world';
import {
  Button,
  EmptyState,
  GlassCard,
  PageTitle,
  RowButton,
  Section,
  useToast,
} from '@/components/next/ui';
import { formatMoney, plural } from '@/lib/next/selectors';
import {
  BADGE_ICON,
  giftsOf,
  saveAs,
  suggestName,
  verdictOf,
  winnerLine,
  type Gift,
  type VerdictView,
} from './data';
import { Burst, RevealAmount } from './motion';
import {
  BadgesSheet,
  GiftsSheet,
  SaveSheet,
  StreaksSheet,
  type VerdictSheet,
} from './sheets';
import styles from './verdict.module.css';

/** The verdict, version 1. */
export default function VerdictV1() {
  const world = useWorld();
  const { navigate } = useNav();
  const { update, undo } = useDemo();
  const toast = useToast();
  const [given, setGiven] = useState<Record<string, boolean>>({});
  const [sheet, setSheet] = useState<VerdictSheet>(null);
  const v = verdictOf(world);

  if (!v)
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

  const gifts = giftsOf(v);
  // The gift you give comes first: marking it is yours to do; the one you get you only confirm.
  const next =
    gifts.find((g) => !given[g.id] && g.from.isMe) ??
    gifts.find((g) => !given[g.id]);
  const setOne = (id: string, value: boolean) =>
    setGiven((s) => ({ ...s, [id]: value }));
  const mark = (g: Gift) => {
    setOne(g.id, true);
    toast({
      text: `${giftName(g)} marked as ${g.to.isMe ? 'received' : 'given'}`,
      action: { label: 'Undo', onClick: () => setOne(g.id, false) },
    });
  };
  const close = (open: boolean) => {
    if (!open) setSheet(null);
  };

  return (
    <PlainFrame back={{ to: 'home', label: 'Your challenges' }}>
      <div className="flex flex-col gap-10 pb-10">
        <PageTitle
          kicker={`${v.name} · ${v.range}`}
          title={winnerLine(world, v)}
        />

        <div className="-mt-4 flex flex-col gap-4">
          {gifts.map((g, i) => (
            <GiftCard
              key={g.id}
              gift={g}
              index={i}
              given={!!given[g.id]}
              primary={next?.id === g.id}
              onMark={() => mark(g)}
              onUndo={() => setOne(g.id, false)}
              onOpen={() => setSheet('gifts')}
            />
          ))}
        </div>

        <Section title="Best streaks" index={3}>
          {[v.me, v.partner].map((s) => (
            <RowButton
              key={s.person.id}
              leading={
                <span className="grid size-11 place-items-center rounded-full bg-nx-accent-soft text-nx-accent">
                  <Flame size={22} aria-hidden="true" />
                </span>
              }
              title={s.streak.title}
              detail={`${s.isMe ? 'You' : s.person.name} · ${s.streak.all ? `all ${s.streak.days} days` : `${s.streak.days} days in a row`}`}
              onClick={() => setSheet('streaks')}
            />
          ))}
        </Section>

        <Section title="Badges earned" index={4}>
          {[v.me, v.partner].map((s) => (
            <RowButton
              key={s.person.id}
              leading={<MedalStack side={s} />}
              title={`${s.isMe ? 'You' : s.person.name}: ${plural(s.badges.length, 'badge')}`}
              detail={s.badges
                .slice(0, 3)
                .map((b) => b.title)
                .join(', ')
                .concat(s.badges.length > 3 ? ' and more' : '')}
              onClick={() => setSheet('badges')}
            />
          ))}
        </Section>

        <Section title="What next" index={5}>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button
              variant={next ? 'secondary' : 'primary'}
              icon={RotateCcw}
              onClick={() => navigate('setup')}
            >
              Run it again
            </Button>
            <Button icon={BookmarkPlus} onClick={() => setSheet('save')}>
              Save as…
            </Button>
            <Button
              variant="quiet"
              icon={Plus}
              onClick={() => navigate('start')}
            >
              Start something new
            </Button>
          </div>
        </Section>
      </div>

      <GiftsSheet v={v} open={sheet === 'gifts'} onOpenChange={close} />
      <StreaksSheet
        v={v}
        open={sheet === 'streaks'}
        onOpenChange={close}
        onRunAgain={() => navigate('setup')}
      />
      <BadgesSheet v={v} open={sheet === 'badges'} onOpenChange={close} />
      <SaveSheet
        open={sheet === 'save'}
        onOpenChange={close}
        suggestion={suggestName(world, v.name)}
        taken={world.saved.map((s) => s.name)}
        onSave={(name) => {
          update((w) => saveAs(w, v.past, name));
          toast({
            text: `Saved as ${name}`,
            action: { label: 'Undo', onClick: undo },
          });
        }}
      />
    </PlainFrame>
  );
}

/** "Your $28 gift", "Jordan’s $10 gift". */
const giftName = (g: Gift) =>
  `${g.to.isMe ? 'Your' : `${g.to.person.name}’s`} ${formatMoney(g.amount)} gift`;

/**
 * One gift, revealed: who gets it and how much (the amount counts up once the card is in), who gives
 * it, and the button that marks it given (or, for the gift you get, received). The amount opens how it was set.
 */
function GiftCard({
  gift,
  index,
  given,
  primary,
  onMark,
  onUndo,
  onOpen,
}: {
  gift: Gift;
  index: number;
  given: boolean;
  primary: boolean;
  onMark: () => void;
  onUndo: () => void;
  onOpen: () => void;
}) {
  const delay = 140 + index * 160;
  const { to, from } = gift;
  return (
    <GlassCard
      as="section"
      pad="lg"
      aria-label={giftName(gift)}
      className={styles.reveal}
      style={{ ['--delay' as string]: `${delay}ms` } as CSSProperties}
    >
      <button
        type="button"
        className="nx-press group flex w-full items-start gap-4 rounded-nx text-left"
        onClick={onOpen}
      >
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-nx-accent-soft text-nx-accent">
          <GiftIcon size={24} aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-nx-body font-semibold text-nx-ink">
            {to.isMe ? 'You get a gift of' : `${to.person.name} gets a gift of`}
          </span>
          <span className="font-nx-serif text-nx-num-xl text-nx-ink">
            <RevealAmount amount={gift.amount} delay={delay + 200} />
          </span>
          <span className="text-nx-2 text-nx-ink-2">
            From {from.isMe ? 'you' : from.person.name} ·{' '}
            {plural(from.points, 'point')}
            {from.forgiven > 0 ? ` (${from.forgiven} forgiven)` : ''}
          </span>
        </span>
        <ChevronRight
          className="nx-row-chevron mt-1 transition-transform group-hover:translate-x-0.5"
          size={22}
          aria-hidden="true"
        />
      </button>
      <div className="mt-6 border-t border-nx-line pt-5">
        {given ? (
          <div className="flex min-h-12 items-center gap-3">
            <span className="relative inline-flex items-center gap-2 text-nx-body font-semibold text-nx-done">
              <span
                className={`grid size-8 place-items-center rounded-full bg-nx-done-soft ${styles.pop}`}
              >
                <Check size={18} strokeWidth={2.6} aria-hidden="true" />
              </span>
              {gift.to.isMe ? 'Received' : 'Given'}
              <Burst />
            </span>
            <Button variant="quiet" className="ml-auto" onClick={onUndo}>
              Undo
            </Button>
          </div>
        ) : (
          <Button
            variant={primary ? 'primary' : 'secondary'}
            size={primary ? 'lg' : 'md'}
            full
            icon={Check}
            onClick={onMark}
          >
            {gift.to.isMe ? 'Mark as received' : 'Mark gift as given'}
          </Button>
        )}
      </div>
    </GlassCard>
  );
}

/** Up to three of a person's badges, overlapping. Decorative; the row says how many. */
function MedalStack({ side }: { side: VerdictView['me'] }) {
  return (
    <span className="flex -space-x-3" aria-hidden="true">
      {side.badges.slice(0, 3).map((b) => {
        const Icon = BADGE_ICON[b.id] ?? Trophy;
        return (
          <span
            key={b.id}
            className="grid size-10 place-items-center rounded-full bg-nx-accent-soft text-nx-accent ring-2 ring-nx-surface"
          >
            <Icon size={18} />
          </span>
        );
      })}
    </span>
  );
}
