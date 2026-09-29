// Version 2: a side-by-side scoreboard flips both gifts in at once, then a short checklist and one sticky button mark them given, one after the other.
'use client';
import { useState, type CSSProperties } from 'react';
import {
  BookmarkPlus,
  Check,
  Crown,
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
  ActionBar,
  Avatar,
  Button,
  EmptyState,
  GlassCard,
  PageTitle,
  RowButton,
  Section,
  TapCard,
  useToast,
} from '@/components/next/ui';
import { formatMoney, plural } from '@/lib/next/selectors';
import {
  BADGE_ICON,
  giftsOf,
  saveAs,
  suggestName,
  verdictOf,
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

/** The verdict, version 2. */
export default function VerdictV2() {
  const world = useWorld();
  const { navigate } = useNav();
  const { update, undo } = useDemo();
  const toast = useToast();
  const [given, setGiven] = useState<Record<string, boolean>>({});
  // The gift just marked, and a count so its burst plays again each time.
  const [burst, setBurst] = useState<{ id: string; n: number } | null>(null);
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
  const next = gifts.find((g) => !given[g.id]);
  const setOne = (id: string, value: boolean) =>
    setGiven((s) => ({ ...s, [id]: value }));
  const mark = (g: Gift) => {
    setOne(g.id, true);
    setBurst((b) => ({ id: g.id, n: (b?.n ?? 0) + 1 }));
    toast({
      text: `The ${formatMoney(g.amount)} gift is marked as given`,
      action: { label: 'Undo', onClick: () => setOne(g.id, false) },
    });
  };
  const close = (open: boolean) => {
    if (!open) setSheet(null);
  };

  return (
    <PlainFrame
      back={{ to: 'home', label: 'Your challenges' }}
      aside={
        <Button
          variant="quiet"
          icon={BookmarkPlus}
          onClick={() => setSheet('save')}
        >
          Save as…
        </Button>
      }
    >
      <div className="flex flex-col gap-8">
        <PageTitle kicker={`Finished · ${v.range}`} title={v.name} />

        <GlassCard pad="none" className="nx-enter overflow-hidden">
          <div className="grid grid-cols-2 divide-x divide-nx-line">
            {[v.me, v.partner].map((s, i) => (
              <ScoreColumn
                key={s.person.id}
                side={s}
                won={v.winner === s.person.id}
                index={i}
                onOpen={() => setSheet('gifts')}
              />
            ))}
          </div>
        </GlassCard>

        <Section title="Gifts" index={2}>
          {gifts.map((g) => {
            const done = !!given[g.id];
            return (
              <RowButton
                key={g.id}
                leading={
                  <span
                    className={
                      done
                        ? 'relative grid size-11 place-items-center rounded-full bg-nx-done-soft text-nx-done'
                        : 'relative grid size-11 place-items-center rounded-full border-2 border-dashed border-nx-accent-line text-nx-accent'
                    }
                  >
                    {done ? (
                      <Check
                        size={22}
                        strokeWidth={2.6}
                        className={styles.pop}
                        aria-hidden="true"
                      />
                    ) : (
                      <GiftIcon size={20} aria-hidden="true" />
                    )}
                    {done && burst?.id === g.id && <Burst key={burst.n} />}
                  </span>
                }
                title={
                  g.to.isMe
                    ? `${g.from.person.name} gives you a ${formatMoney(g.amount)} gift`
                    : `You give ${g.to.person.name} a ${formatMoney(g.amount)} gift`
                }
                detail={done ? 'Given' : 'Not given yet'}
                onClick={() => setSheet('gifts')}
              />
            );
          })}
        </Section>

        <Section title="Streaks and badges" index={3}>
          <div className="grid gap-3 sm:grid-cols-2">
            <TapCard className="h-full" onClick={() => setSheet('streaks')}>
              <span className="flex flex-col gap-3">
                <span className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-full bg-nx-accent-soft text-nx-accent">
                    <Flame size={20} aria-hidden="true" />
                  </span>
                  <span className="text-nx-body font-semibold">
                    Best streaks
                  </span>
                </span>
                {[v.me, v.partner].map((s) => (
                  <span key={s.person.id} className="flex flex-col">
                    <span className="text-nx-body">
                      <span className="font-semibold">
                        {s.isMe ? 'You' : s.person.name}:
                      </span>{' '}
                      {s.streak.all
                        ? `all ${s.streak.days} days`
                        : `${s.streak.days} days in a row`}
                    </span>
                    <span className="text-nx-2 text-nx-ink-2">
                      {s.streak.title}
                    </span>
                  </span>
                ))}
              </span>
            </TapCard>
            <TapCard className="h-full" onClick={() => setSheet('badges')}>
              <span className="flex flex-col gap-3">
                <span className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-full bg-nx-accent-soft text-nx-accent">
                    <Trophy size={20} aria-hidden="true" />
                  </span>
                  <span className="text-nx-body font-semibold">
                    Badges earned
                  </span>
                </span>
                {[v.me, v.partner].map((s) => (
                  <span key={s.person.id} className="flex items-center gap-3">
                    <MedalStack side={s} />
                    <span className="text-nx-body">
                      <span className="font-semibold">
                        {s.isMe ? 'You' : s.person.name}:
                      </span>{' '}
                      {plural(s.badges.length, 'badge')}
                    </span>
                  </span>
                ))}
              </span>
            </TapCard>
          </div>
        </Section>

        {next && (
          <Button
            variant="quiet"
            icon={Plus}
            className="-mt-2 self-start"
            onClick={() => navigate('start')}
          >
            Start something new
          </Button>
        )}
      </div>

      <ActionBar>
        {next ? (
          <>
            <Button
              variant="primary"
              size="lg"
              full
              icon={Check}
              onClick={() => mark(next)}
            >
              Mark the {formatMoney(next.amount)} gift as given
            </Button>
            <Button icon={RotateCcw} onClick={() => navigate('setup')}>
              Run it again
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="primary"
              size="lg"
              full
              icon={RotateCcw}
              onClick={() => navigate('setup')}
            >
              Run it again
            </Button>
            <Button
              variant="quiet"
              icon={Plus}
              onClick={() => navigate('start')}
            >
              Start something new
            </Button>
          </>
        )}
      </ActionBar>

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

/**
 * One person on the scoreboard: who, their points, whether they won, and the gift they get, which
 * flips in and counts up. The whole column opens how the gifts were set.
 */
function ScoreColumn({
  side: s,
  won,
  index,
  onOpen,
}: {
  side: VerdictView['me'];
  won: boolean;
  index: number;
  onOpen: () => void;
}) {
  const delay = 180 + index * 140;
  return (
    <button
      type="button"
      className="nx-press flex min-w-0 flex-col items-center gap-1.5 px-3 pt-6 pb-7 text-center transition-colors hover:bg-nx-accent-soft"
      onClick={onOpen}
    >
      <span className="relative mb-1">
        <Avatar person={s.person} size="lg" decorative />
        {won && (
          <span
            className="absolute -top-2 -right-2 grid size-7 place-items-center rounded-full text-nx-on-accent shadow-nx-glass"
            style={{ background: 'var(--nx-primary)' }}
            aria-hidden="true"
          >
            <Crown size={15} strokeWidth={2.4} />
          </span>
        )}
      </span>
      <span className="text-nx-body font-semibold text-nx-ink">
        {s.isMe ? 'You' : s.person.name}
      </span>
      <span className="flex min-h-7 flex-wrap items-center justify-center gap-2 text-nx-2 text-nx-ink-2">
        {plural(s.points, 'point')}
        {won && (
          <span className="rounded-full bg-nx-accent-soft px-2.5 py-0.5 text-nx-min font-semibold text-nx-accent">
            Won
          </span>
        )}
      </span>
      <span className="mt-4 text-nx-2 text-nx-ink-2">
        {s.isMe ? 'You get' : `${s.person.name} gets`}
      </span>
      <span
        className={`${styles.flip} font-nx-serif text-nx-num-lg text-nx-ink`}
        style={{ ['--delay' as string]: `${delay}ms` } as CSSProperties}
      >
        <RevealAmount amount={s.gets} delay={delay + 120} />
      </span>
    </button>
  );
}

/** Up to three of a person's badges, overlapping. Decorative; the line says how many. */
function MedalStack({ side }: { side: VerdictView['me'] }) {
  return (
    <span className="flex shrink-0 -space-x-3" aria-hidden="true">
      {side.badges.slice(0, 3).map((b) => {
        const Icon = BADGE_ICON[b.id] ?? Trophy;
        return (
          <span
            key={b.id}
            className="grid size-9 place-items-center rounded-full bg-nx-accent-soft text-nx-accent ring-2 ring-nx-surface"
          >
            <Icon size={16} />
          </span>
        );
      })}
    </span>
  );
}
