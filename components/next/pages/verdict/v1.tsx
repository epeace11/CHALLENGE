// The result is the title in plain words; each gift is its own large card with its own button, and the next one to mark is the main action.
'use client';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  Check,
  ChevronRight,
  Flame,
  Plus,
  RotateCcw,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { PlainFrame } from '@/components/next/frames';
import { Button, GlassCard, useReducedMotion } from '@/components/next/ui';
import { cn } from '@/lib/utils';
import { formatMoney, plural } from '@/lib/next/selectors';
import type { Gift, VerdictView } from './data';
import { Burst, RevealAmount } from './motion';
import {
  HandOff,
  NoVerdict,
  OpenDisputesRow,
  SaveAsButton,
  VerdictSheets,
  badgeLine,
  outcome,
  possessive,
  streakLine,
  useVerdictPage,
} from './shared';
import styles from './verdict.module.css';

/** The verdict: the result, then each gift. */
export default function VerdictV1() {
  const page = useVerdictPage();
  const {
    v,
    gifts,
    given,
    next,
    mark,
    unmark,
    burst,
    setSheet,
    runAgain,
    navigate,
    openDisputes,
  } = page;
  // After a gift is marked or taken back, the screen's main action scrolls into view if it's below
  // the fold (the card just settled stays in sight) and takes focus, so a keyboard carries on there.
  const [moves, setMoves] = useState(0);
  const primary = useRef<HTMLButtonElement | null>(null);
  const keep = (el: HTMLButtonElement | null) => {
    if (el) primary.current = el;
  };
  const still = useReducedMotion();
  useEffect(() => {
    const el = primary.current;
    if (!moves || !el) return;
    el.scrollIntoView({
      block: 'nearest',
      behavior: still ? 'auto' : 'smooth',
    });
    el.focus({ preventScroll: true });
  }, [moves, still]);

  if (!v) return <NoVerdict />;
  const openGifts = () => setSheet('gifts');

  return (
    <PlainFrame
      back={{ to: 'home', label: 'Your challenges' }}
      aside={<SaveAsButton onClick={() => setSheet('save')} />}
    >
      <div className="flex flex-col gap-6 sm:gap-8">
        <header className="nx-enter flex flex-col gap-3 pt-2">
          <h1 className={styles.result}>{resultTitle(v)}</h1>
          <p className="text-nx-lead text-nx-ink-2">
            <ResultLine v={v} onOpen={openGifts} />
          </p>
        </header>

        {openDisputes > 0 && (
          <OpenDisputesRow
            className="nx-enter -mt-3"
            count={openDisputes}
            onOpen={() => navigate('review')}
          />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {gifts.map((g, i) => (
            <GiftCard
              key={g.id}
              gift={g}
              index={i}
              done={!!given[g.id]}
              main={next?.id === g.id}
              burst={burst?.id === g.id ? burst.n : 0}
              buttonRef={next?.id === g.id ? keep : undefined}
              onMark={() => {
                mark(g);
                setMoves((m) => m + 1);
              }}
              onUnmark={() => {
                unmark(g);
                setMoves((m) => m + 1);
              }}
              onOpen={openGifts}
            />
          ))}
        </div>

        <GlassCard
          pad="none"
          className="nx-enter grid divide-y divide-nx-line overflow-hidden sm:grid-cols-2 sm:divide-x sm:divide-y-0"
          style={{ ['--nx-i' as string]: 3 } as CSSProperties}
        >
          <MiniRow
            icon={Flame}
            title="Best streaks"
            detail={streakLine(v)}
            onClick={() => setSheet('streaks')}
          />
          <MiniRow
            icon={Trophy}
            title="Badges"
            detail={badgeLine(v)}
            onClick={() => setSheet('badges')}
          />
        </GlassCard>

        <div
          className="nx-enter -mt-2 flex flex-col gap-2 sm:flex-row sm:items-center"
          style={{ ['--nx-i' as string]: 4 } as CSSProperties}
        >
          <Button
            ref={next ? undefined : keep}
            variant={next ? 'secondary' : 'primary'}
            size="lg"
            icon={RotateCcw}
            className="w-full scroll-mb-6 sm:w-auto sm:min-w-60"
            onClick={runAgain}
          >
            Run it again
          </Button>
          <Button
            variant="quiet"
            icon={Plus}
            className="self-center sm:self-auto"
            onClick={() => navigate('start')}
          >
            Start something new
          </Button>
        </div>
      </div>

      <VerdictSheets page={page} />
    </PlainFrame>
  );
}

/** "You won Summer Sprint", "Jordan won Summer Sprint", or "Summer Sprint was a tie". */
function resultTitle(v: VerdictView) {
  const won = outcome(v);
  if (won === 'tie') return `${v.name} was a tie`;
  return `${won === 'me' ? 'You' : v.partner.person.name} won ${v.name}`;
}

/** "4 points to Jordan’s 7. Fewer points wins.", the winner first; each number opens how the gifts were set. */
function ResultLine({ v, onOpen }: { v: VerdictView; onOpen: () => void }) {
  const won = outcome(v),
    partner = v.partner.person.name;
  if (won === 'tie')
    return (
      <>
        <NumLink onClick={onOpen}>{plural(v.me.points, 'point')} each</NumLink>.
      </>
    );
  return (
    <>
      {won === 'me' ? (
        <>
          <NumLink onClick={onOpen}>{plural(v.me.points, 'point')}</NumLink> to{' '}
          <NumLink onClick={onOpen}>
            {possessive(partner)} {v.partner.points}
          </NumLink>
        </>
      ) : (
        <>
          <NumLink onClick={onOpen}>
            {possessive(partner)} {plural(v.partner.points, 'point')}
          </NumLink>{' '}
          to <NumLink onClick={onOpen}>your {v.me.points}</NumLink>
        </>
      )}
      . Fewer points wins.
    </>
  );
}

/** A number in a sentence, as a button that opens a sheet. */
function NumLink({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={styles.num}
      aria-haspopup="dialog"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/**
 * One gift as its own card: who gives whom, and the amount, which flips in and counts up, beside the
 * gift on its way (the top opens how it was set); then whether it's given or received yet, and its
 * button. Marking it settles the card: the gift slides across to the one who gets it, and a check
 * bursts where the button was, beside Undo.
 */
function GiftCard({
  gift: g,
  index,
  done,
  main,
  burst,
  buttonRef,
  onMark,
  onUnmark,
  onOpen,
}: {
  gift: Gift;
  index: number;
  done: boolean;
  /** Its button is the screen's main action. */
  main: boolean;
  /** Counts up each time it's marked here, so the burst plays again. */
  burst: number;
  buttonRef?: (el: HTMLButtonElement | null) => void;
  onMark: () => void;
  /** Takes the mark back (Undo on the strip). */
  onUnmark: () => void;
  onOpen: () => void;
}) {
  const giving = g.from.isMe;
  const delay = 200 + index * 140;
  return (
    <GlassCard
      as="article"
      pad="none"
      className="nx-enter flex flex-col"
      style={{ ['--nx-i' as string]: index + 1 } as CSSProperties}
    >
      <button
        type="button"
        className="nx-press relative flex flex-1 flex-col items-start rounded-t-nx-lg px-5 pt-5 pb-3 text-left transition-colors hover:bg-nx-accent-soft sm:px-6 sm:pt-6"
        aria-haspopup="dialog"
        onClick={onOpen}
      >
        <ChevronRight
          className="nx-row-chevron absolute top-5 right-4 sm:top-6 sm:right-5"
          size={22}
          aria-hidden="true"
        />
        {/* Phones: the label, then the amount with the hand-off beside it. Two columns: the hand-off on
            top, so both cards line up whatever the amounts. */}
        <span className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 sm:flex-col sm:items-start">
          <span className="w-full pr-8 text-nx-body text-nx-ink-2">
            {giving
              ? `You give ${g.to.person.name}`
              : `${g.from.person.name} gives you`}
          </span>{' '}
          <span
            className={cn(
              styles.flip,
              'font-nx-serif text-nx-num-xl text-nx-ink tabular-nums',
            )}
            style={{ ['--delay' as string]: `${delay}ms` } as CSSProperties}
          >
            <RevealAmount amount={g.amount} delay={delay + 120} />
          </span>
          <span className="ml-auto sm:order-first sm:mb-2 sm:ml-0">
            <HandOff gift={g} done={done} />
          </span>
        </span>
      </button>
      <div className="flex min-h-[108px] flex-col justify-end gap-2.5 px-5 pt-2 pb-5 sm:min-h-[112px] sm:px-6 sm:pb-6">
        {done ? (
          <div
            className={cn(
              styles.settle,
              'flex min-h-12 items-center gap-3 rounded-nx-sm bg-nx-done-soft pr-1 pl-3',
            )}
          >
            <span className="relative grid size-7 shrink-0 place-items-center rounded-full bg-nx-done text-nx-surface">
              <Check
                size={17}
                strokeWidth={3}
                className={styles.pop}
                aria-hidden="true"
              />
              {burst > 0 && <Burst key={burst} />}
            </span>
            <span className="flex-1 text-nx-body font-semibold text-nx-done">
              {giving ? 'Given' : 'Received'}
            </span>
            <Button
              variant="quiet"
              aria-label={
                giving
                  ? `Undo: mark your ${formatMoney(g.amount)} gift as not given`
                  : `Undo: mark the ${formatMoney(g.amount)} gift as not received`
              }
              onClick={onUnmark}
            >
              Undo
            </Button>
          </div>
        ) : (
          <>
            <p className="text-nx-2 text-nx-ink-2">
              {giving ? 'Not given yet' : 'Not received yet'}
            </p>
            <Button
              ref={buttonRef}
              variant={main ? 'primary' : 'secondary'}
              size="lg"
              full
              icon={Check}
              className="scroll-mb-6"
              onClick={onMark}
            >
              {giving ? 'Mark as given' : 'Mark as received'}
            </Button>
          </>
        )}
      </div>
    </GlassCard>
  );
}

/** Half of the streaks-and-badges row: an icon, what it is, both people's numbers, and a chevron. */
function MiniRow({
  icon: Icon,
  title,
  detail,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="nx-press flex min-h-16 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-nx-accent-soft"
      aria-haspopup="dialog"
      onClick={onClick}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-nx-accent-soft text-nx-accent">
        <Icon size={20} aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-nx-body font-semibold text-nx-ink">{title}</span>
        <span className="text-nx-2 text-nx-ink-2">{detail}</span>
      </span>
      <ChevronRight className="nx-row-chevron" size={22} aria-hidden="true" />
    </button>
  );
}
