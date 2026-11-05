// One card per challenge with everything about it together (Summer Sprint's verdict, rules and share link in one place); the main action sits under the title.
'use client';
import { useState, type ReactNode } from 'react';
import {
  ArrowRight,
  ChevronRight,
  ListChecks,
  EyeOff,
  Plus,
  Trophy,
} from 'lucide-react';
import type { PastChallenge, SavedChallenge } from '@/lib/next/model';
import { AccountMenu, AppFrame, PlainFrame } from '@/components/next/frames';
import {
  Button,
  CountUp,
  Enter,
  GlassCard,
  PageTitle,
  ProgressBar,
  RowButton,
} from '@/components/next/ui';
import {
  deleteChallenge,
  deleteSaved,
  hideChallenge,
  hideSaved,
} from '@/lib/next/actions';
import { useBackend } from '@/components/next/backend';
import { useNav } from '@/components/next/nav';
import { useWorld } from '@/components/next/world';
import {
  asIfSignedToday,
  formatDate,
  formatRange,
  lastDay,
  plural,
} from '@/lib/next/selectors';
import { cn } from '@/lib/utils';
import { DeleteChallengeSheet, deletedForYouLine } from './delete-sheet';
import { HiddenSheet, type HiddenItem } from './hidden-sheet';
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
import { showVerdictFor } from '../verdict/which';

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
  const backend = useBackend();
  const { host } = backend;
  // What the Delete sheet asks about; it stays set while the sheet closes.
  const [deleting, setDeleting] = useState<{
    name: string;
    description: string;
    remove: () => Promise<boolean>;
  } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const ask = (d: NonNullable<typeof deleting>) => {
    setDeleting(d);
    setConfirming(true);
  };
  /** Starts a new challenge from a saved one (the live app), or opens Set up (the preview). */
  const startFrom = (saved: SavedChallenge) =>
    host ? void host.startFrom({ kind: 'saved', saved }) : navigate('setup');
  // Each finished challenge with the saved copy that runs it again; then saved ones never run. Hidden
  // ones are only in this person's Hidden list.
  const all = world.past.map((p) => ({
    past: p,
    saved: savedFor(world, p),
  }));
  const finished = all.filter((f) => !f.past.hidden);
  const others = world.saved.filter(
    (s) => !s.hidden && !all.some((f) => f.saved?.id === s.id),
  );
  /** Takes a challenge off this person's list; the saved copy that goes with it follows it. */
  const hidePast = (id: string, hidden: boolean) =>
    backend.act({ type: 'hideChallenge', challengeId: id, hidden }, (w) =>
      hideChallenge(w, id, hidden),
    );
  const hidden: HiddenItem[] = [
    ...all
      .filter((f) => f.past.hidden)
      .map(({ past, saved }): HiddenItem => {
        const id = past.challenge.id;
        // Its saved copy goes too, unless another challenge of theirs still runs from it.
        const copy =
          saved &&
          all.filter((f) => f.saved?.id === saved.id).length === 1 &&
          saved;
        return {
          id,
          name: past.challenge.name,
          detail: finishedLine(past),
          restore: () => hidePast(id, false),
          remove: () =>
            ask({
              name: past.challenge.name,
              description: deletedForYouLine(
                (past.partner ?? world.partner).name,
              ),
              remove: () =>
                backend.save(
                  [
                    { type: 'deleteChallenge', challengeId: id },
                    ...(copy
                      ? [{ type: 'deleteSaved', savedId: copy.id } as const]
                      : []),
                  ],
                  (w) => {
                    const gone = deleteChallenge(w, id);
                    return copy ? deleteSaved(gone, copy.id) : gone;
                  },
                ),
            }),
        };
      }),
    ...world.saved
      .filter((s) => s.hidden && !all.some((f) => f.saved?.id === s.id))
      .map(
        (s): HiddenItem => ({
          id: s.id,
          name: s.name,
          detail: sizeLine(s),
          restore: () =>
            backend.act(
              { type: 'hideSaved', savedId: s.id, hidden: false },
              (w) => hideSaved(w, s.id, false),
            ),
          remove: () =>
            ask({
              name: s.name,
              description: deletedForYouLine(world.partner.name),
              remove: () =>
                backend.save({ type: 'deleteSaved', savedId: s.id }, (w) =>
                  deleteSaved(w, s.id),
                ),
            }),
        }),
      ),
  ];
  const status = world.challenge.status;
  // Before Day 1 there is nothing for the tabs to show yet, so the page has the plain frame.
  const settingUp = status !== 'running' && status !== 'finished';
  const frame = (children: ReactNode) =>
    settingUp ? (
      <PlainFrame aside={<AccountMenu cancel={status === 'draft'} />}>
        {children}
      </PlainFrame>
    ) : (
      <AppFrame>{children}</AppFrame>
    );

  // A new one can start at any time. It is the main action only once this one has finished; while
  // one runs or is being set up, that challenge's own button is, and this one follows it.
  const finishedNow = status === 'finished';
  const startNew = (
    <Enter index={finishedNow ? 1 : 3}>
      <Button
        variant={finishedNow ? 'primary' : 'secondary'}
        size={finishedNow ? 'lg' : 'md'}
        icon={Plus}
        className="w-full sm:w-auto"
        onClick={() => navigate('start')}
      >
        Start a new challenge
      </Button>
    </Enter>
  );

  return frame(
    <>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
        <div className="flex flex-col gap-6">
          <PageTitle title="Your challenges" />
          {finishedNow && startNew}

          {settingUp && (
            <Enter index={2}>
              <NotStarted />
            </Enter>
          )}

          {world.challenge.status === 'running' && (
            <Enter index={2}>
              <ChallengeCard
                kicker={
                  world.partners.length > 1
                    ? `Running now, with ${world.partner.name}`
                    : 'Running now'
                }
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
                {/* The card's title names it, so the button does not. */}
                <Button
                  variant="primary"
                  size="lg"
                  iconEnd={ArrowRight}
                  className="w-full sm:w-auto sm:self-start"
                  onClick={() => navigate('overview')}
                >
                  Open challenge
                </Button>
              </ChallengeCard>
            </Enter>
          )}
          {world.others.map((o, i) => (
            <Enter key={o.id} index={3 + i}>
              <ChallengeCard
                kicker={`With ${o.partner}`}
                name={o.name}
                detail={o.line}
              >
                <Button
                  className="self-start"
                  onClick={() =>
                    host ? host.openChallenge(o.id) : navigate('overview')
                  }
                >
                  Open challenge
                </Button>
              </ChallengeCard>
            </Enter>
          ))}
          {!finishedNow && startNew}
        </div>

        <div className="flex flex-col gap-6">
          {finished.map(({ past, saved }, i) => (
            <Enter key={past.challenge.id} index={3 + i}>
              <ChallengeCard
                kicker={finishedLine(past)}
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
                    onClick={() => {
                      showVerdictFor(past.challenge.id);
                      navigate('verdict');
                    }}
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
                      onClick={() => startFrom(saved)}
                    >
                      {startLabel(saved)}
                    </Button>
                  </>
                )}
                <HideButton onClick={() => hidePast(past.challenge.id, true)} />
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
                <Button className="self-start" onClick={() => startFrom(s)}>
                  {startLabel(s)}
                </Button>
                <HideButton
                  onClick={() =>
                    backend.act(
                      { type: 'hideSaved', savedId: s.id, hidden: true },
                      (w) => hideSaved(w, s.id, true),
                    )
                  }
                />
              </ChallengeCard>
            </Enter>
          ))}
          {hidden.length > 0 && (
            <Enter index={3 + finished.length + others.length}>
              <RowButton
                leading={
                  <EyeOff
                    size={22}
                    className="text-nx-accent"
                    aria-hidden="true"
                  />
                }
                title="Hidden"
                detail={`${plural(hidden.length, 'challenge')}, only on your account`}
                onClick={() => setShowHidden(true)}
              />
            </Enter>
          )}
        </div>
      </div>

      <HiddenSheet
        items={hidden}
        open={showHidden}
        onOpenChange={setShowHidden}
      />
      <DeleteChallengeSheet
        name={deleting?.name ?? ''}
        description={deleting?.description ?? ''}
        open={confirming}
        onOpenChange={setConfirming}
        onDelete={() => deleting?.remove()}
      />
      <SavedSheet
        saved={shown}
        open={open}
        onOpenChange={setOpen}
        onStart={() => shown && startFrom(shown)}
      />
    </>,
  );
}

/**
 * "Finished Jul 28", or just "Finished" when it ended on its last day: the dates under the name
 * ("Jul 6 – 26") already say that day.
 */
function finishedLine(past: PastChallenge) {
  const on = past.verdict.finishedOn;
  return on === lastDay(past.challenge)
    ? 'Finished'
    : `Finished ${formatDate(on)}`;
}

/** The challenge being set up, invited or signed: where it stands and the one step left. */
function NotStarted() {
  const world = useWorld();
  const { navigate } = useNav();
  const { live } = useBackend();
  const c = world.challenge;
  const partner = world.partner.name;
  const signed = (id: string) =>
    world.pact.signatures.some((s) => s.personId === id && s.signedAt);
  const step =
    c.status === 'draft'
      ? { label: 'Keep setting up', to: 'setup' as const }
      : c.status === 'invited'
        ? signed(world.me.id)
          ? {
              // The live app opens the invite link page by default; the preview shows the Invite page.
              label: 'Send the invite link',
              to: live ? null : ('invite' as const),
              note: `Waiting for ${partner} to join`,
            }
          : // Setup is done; the one who set it up signs before inviting.
            { label: 'Sign the pact', to: 'pact' as const }
        : signed(world.me.id)
          ? {
              label: 'See the rules',
              to: 'setup' as const,
              note: `Waiting for ${partner} to sign`,
            }
          : { label: 'Sign the pact', to: 'pact' as const };
  return (
    <ChallengeCard
      kicker="Not started yet"
      name={c.name}
      detail={
        'note' in step && step.note
          ? step.note
          : `Starts ${formatDate(asIfSignedToday(c, world.today).start)} · ${c.days} days`
      }
    >
      <Button
        variant="primary"
        size="lg"
        iconEnd={ArrowRight}
        className="w-full sm:w-auto"
        onClick={() => navigate(step.to)}
      >
        {step.label}
      </Button>
    </ChallengeCard>
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

/** A card's quiet Hide, last in the card: it moves to this person's Hidden list. */
function HideButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="quiet"
      icon={EyeOff}
      className="-ml-3 self-start"
      onClick={onClick}
    >
      Hide
    </Button>
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
