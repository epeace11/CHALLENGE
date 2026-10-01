// One card per challenge with everything about it together (Summer Sprint's verdict, rules and share link in one place); the main action sits under the title.
'use client';
import { useState, type ReactNode } from 'react';
import { ChevronRight, ListChecks, Plus, Trophy } from 'lucide-react';
import type { SavedChallenge } from '@/lib/next/model';
import { AppFrame } from '@/components/next/frames';
import {
  Button,
  CountUp,
  Enter,
  GlassCard,
  PageTitle,
  ProgressBar,
} from '@/components/next/ui';
import { useNav } from '@/components/next/nav';
import { useWorld } from '@/components/next/world';
import { formatDate, formatRange, lastDay } from '@/lib/next/selectors';
import { cn } from '@/lib/utils';
import { SavedSheet } from './saved-sheet';
import { ShareLink } from './share-link';
import {
  savedFor,
  sizeLine,
  sourceLine,
  startLabel,
  verdictLine,
} from './helpers';
import { useRunning } from './use-running';
import styles from './home.module.css';

/** Your challenges, version 2. */
export default function HomeV2() {
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
  // Each finished challenge with the saved copy that runs it again; then saved ones never run.
  const finished = world.past.map((p) => ({
    past: p,
    saved: savedFor(world, p),
  }));
  const others = world.saved.filter(
    (s) => !finished.some((f) => f.saved?.id === s.id),
  );

  return (
    <AppFrame>
      <div className="grid gap-6">
        <div className="flex flex-col gap-6">
          <PageTitle title="Your challenges" />
          <Enter index={1}>
            <Button
              variant="primary"
              size="lg"
              icon={Plus}
              className="w-full sm:w-auto"
              onClick={() => navigate('start')}
            >
              Start a new challenge
            </Button>
          </Enter>

          <Enter index={2}>
            <ChallengeCard
              kicker="Running now"
              name={run.name}
              detail={run.range}
            >
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
              <Rows>
                <Row
                  lead={
                    <span className={styles.count}>
                      <CountUp value={run.left} />
                    </span>
                  }
                  title="Left to log"
                  detail={
                    run.openDay && run.left
                      ? `${run.openDay}, ${run.leftHint}`
                      : run.leftHint
                  }
                  onClick={() => navigate('log')}
                />
                <Row
                  lead={
                    <span className={styles.count} data-tone="wait">
                      <CountUp value={run.waiting} />
                    </span>
                  }
                  title="To review"
                  detail={run.waitingHint}
                  onClick={() => navigate('review')}
                />
              </Rows>
            </ChallengeCard>
          </Enter>
        </div>

        <div className="flex flex-col gap-6">
          {finished.map(({ past, saved }, i) => (
            <Enter key={past.challenge.id} index={3 + i}>
              <ChallengeCard
                kicker={`Finished ${formatDate(past.verdict.finishedOn)}`}
                name={past.challenge.name}
                detail={formatRange(
                  past.challenge.start,
                  lastDay(past.challenge),
                )}
              >
                <Rows>
                  <Row
                    lead={
                      <span className={styles.badge}>
                        <Trophy size={22} aria-hidden="true" />
                      </span>
                    }
                    title={verdictLine(world, past)}
                    detail="See the verdict"
                    onClick={() => navigate('verdict')}
                  />
                  {saved && (
                    <Row
                      lead={
                        <span className={styles.badge}>
                          <ListChecks size={22} aria-hidden="true" />
                        </span>
                      }
                      title={sizeLine(saved)}
                      detail="See the rules"
                      onClick={() => openSaved(saved)}
                    />
                  )}
                </Rows>
                {saved && (
                  <>
                    <div className="border-t border-nx-line pt-1">
                      <ShareLink saved={saved} />
                    </div>
                    <Button
                      className="self-start"
                      onClick={() => navigate('setup')}
                    >
                      {startLabel(saved)}
                    </Button>
                  </>
                )}
              </ChallengeCard>
            </Enter>
          ))}
          {others.map((s, i) => (
            <Enter key={s.id} index={3 + finished.length + i}>
              <ChallengeCard kicker={sourceLine(s)} name={s.name}>
                <Rows>
                  <Row
                    lead={
                      <span className={styles.badge}>
                        <ListChecks size={22} aria-hidden="true" />
                      </span>
                    }
                    title={sizeLine(s)}
                    detail="See the rules"
                    onClick={() => openSaved(s)}
                  />
                </Rows>
                {s.source === 'mine' && (
                  <div className="border-t border-nx-line pt-1">
                    <ShareLink saved={s} />
                  </div>
                )}
                <Button
                  className="self-start"
                  onClick={() => navigate('setup')}
                >
                  {startLabel(s)}
                </Button>
              </ChallengeCard>
            </Enter>
          ))}
        </div>
      </div>

      <SavedSheet
        saved={shown}
        open={open}
        onOpenChange={setOpen}
        onStart={() => navigate('setup')}
      />
    </AppFrame>
  );
}

/** One challenge: a kicker saying where it stands, its name, and what can be done with it. */
function ChallengeCard({
  kicker,
  name,
  detail,
  children,
}: {
  kicker: string;
  name: string;
  detail?: string;
  children: ReactNode;
}) {
  return (
    <GlassCard pad="lg" as="article" className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <p className="nx-kicker">{kicker}</p>
        <h2 className="font-nx-serif text-nx-h2">{name}</h2>
        {detail && <p className="text-nx-2 text-nx-ink-2">{detail}</p>}
      </header>
      {children}
    </GlassCard>
  );
}

function Rows({ children }: { children: ReactNode }) {
  return <div className={cn(styles.rows, styles.list)}>{children}</div>;
}

/** A row that is one button: a lead (a count or an icon), what it is, where it goes. */
function Row({
  lead,
  title,
  detail,
  onClick,
}: {
  lead: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" className={styles.row} onClick={onClick}>
      {lead}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-nx-body font-semibold text-nx-ink">{title}</span>
        {detail && <span className="text-nx-2 text-nx-ink-2">{detail}</span>}
      </span>
      <ChevronRight className={styles.chevron} size={22} aria-hidden="true" />
    </button>
  );
}
