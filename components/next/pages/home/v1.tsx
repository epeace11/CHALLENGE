// Version 1: sorted by kind: the running challenge with its two numbers, then Saved, then Finished; the main action stays at the bottom.
'use client';
import { useState } from 'react';
import { ChevronRight, Plus, Trophy } from 'lucide-react';
import type { SavedChallenge } from '@/lib/next/model';
import { AppFrame } from '@/components/next/frames';
import {
  ActionBar,
  Button,
  GlassCard,
  PageTitle,
  ProgressBar,
  RowButton,
  Section,
  StatButton,
} from '@/components/next/ui';
import { useNav } from '@/components/next/nav';
import { useWorld } from '@/components/next/world';
import { formatRange, lastDay } from '@/lib/next/selectors';
import { SavedSheet } from './saved-sheet';
import { ShareLink } from './share-link';
import { sizeLine, sourceLine, startLabel, verdictLine } from './helpers';
import { useRunning } from './use-running';
import styles from './home.module.css';

/** Your challenges, version 1. */
export default function HomeV1() {
  const world = useWorld();
  const { navigate } = useNav();
  const run = useRunning();
  const [open, setOpen] = useState(false);
  const [shownId, setShownId] = useState<string | null>(null);
  const shown = world.saved.find((s) => s.id === shownId) ?? null;
  const openSaved = (s: SavedChallenge) => {
    setShownId(s.id);
    setOpen(true);
  };

  return (
    <AppFrame>
      <div className="flex flex-col gap-10 pb-2">
        <PageTitle title="Your challenges" />

        <Section title="Running now" index={1}>
          <GlassCard pad="lg" className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <h3 className="font-nx-serif text-nx-h2">{run.name}</h3>
              <p className="text-nx-2 text-nx-ink-2">{run.range}</p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="nx-press -ml-2 inline-flex min-h-11 items-center gap-1 self-start rounded-nx-sm px-2 text-nx-body font-semibold text-nx-ink hover:bg-nx-accent-soft"
                onClick={() => navigate('progress')}
              >
                Day {run.day} of {run.days}
                <ChevronRight
                  size={20}
                  className="text-nx-accent"
                  aria-hidden="true"
                />
              </button>
              <ProgressBar
                value={run.day}
                max={run.days}
                label={`Day ${run.day} of ${run.days}`}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatButton
                glass={false}
                tone="accent"
                label="Left to log"
                value={run.left}
                hint={run.leftHint}
                onClick={() => navigate('log')}
              />
              <StatButton
                glass={false}
                tone="wait"
                label="To review"
                value={run.waiting}
                hint={run.waitingHint}
                onClick={() => navigate('review')}
              />
            </div>
          </GlassCard>
        </Section>

        {world.saved.length > 0 && (
          <Section title="Saved" index={2}>
            {world.saved.map((s) => (
              <GlassCard key={s.id} pad="none" as="article">
                <button
                  type="button"
                  className={`${styles.row} rounded-t-[23px]`}
                  aria-label={`${s.name}, ${sourceLine(s)}, ${sizeLine(s)}: see the rules`}
                  onClick={() => openSaved(s)}
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-nx-serif text-nx-h3">{s.name}</span>
                    <span className="text-nx-2 text-nx-ink-2">
                      {sourceLine(s)} · {sizeLine(s)}
                    </span>
                  </span>
                  <ChevronRight
                    className={styles.chevron}
                    size={22}
                    aria-hidden="true"
                  />
                </button>
                {s.source === 'mine' && (
                  <div className="border-t border-nx-line px-5 py-1">
                    <ShareLink saved={s} />
                  </div>
                )}
                <div className="border-t border-nx-line px-5 py-4">
                  <Button onClick={() => navigate('setup')}>
                    {startLabel(s)}
                  </Button>
                </div>
              </GlassCard>
            ))}
          </Section>
        )}

        {world.past.length > 0 && (
          <Section title="Finished" index={3}>
            {world.past.map((p) => (
              <RowButton
                key={p.challenge.id}
                leading={
                  <span className={styles.badge}>
                    <Trophy size={22} aria-hidden="true" />
                  </span>
                }
                title={p.challenge.name}
                detail={`${formatRange(p.challenge.start, lastDay(p.challenge))} · ${verdictLine(world, p)}`}
                onClick={() => navigate('verdict')}
              />
            ))}
          </Section>
        )}
      </div>

      <ActionBar>
        <Button
          variant="primary"
          size="lg"
          full
          icon={Plus}
          onClick={() => navigate('start')}
        >
          Start a new challenge
        </Button>
      </ActionBar>

      <SavedSheet
        saved={shown}
        open={open}
        onOpenChange={setOpen}
        onStart={() => navigate('setup')}
      />
    </AppFrame>
  );
}
