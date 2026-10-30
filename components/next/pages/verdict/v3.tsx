// One gift at a time: a compact result line, then the gift you give, the gift you get and a closing view, each gliding in once the last is marked.
'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronRight,
  Crown,
  Flame,
  Gift as GiftIcon,
  Plus,
  RotateCcw,
  Trophy,
} from 'lucide-react';
import { PlainFrame } from '@/components/next/frames';
import {
  Avatar,
  Button,
  Glide,
  GlassCard,
  RowButton,
} from '@/components/next/ui';
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

/** What the card shows: a gift (by who receives it), or the closing view. */
const END = 'end';

/** The verdict, version 3. */
export default function VerdictV3() {
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
  // It opens on the first gift still to mark, or the closing view once both are.
  const [nav, setNav] = useState<{ step: string; dir: 1 | -1 }>(() => ({
    step: next?.id ?? END,
    dir: 1,
  }));
  // Marking, moving on and taking a mark back hand focus to the new view's main button, so a keyboard carries on there.
  const [moves, setMoves] = useState(0);
  const primary = useRef<HTMLButtonElement | null>(null);
  const keep = (el: HTMLButtonElement | null) => {
    if (el) primary.current = el;
  };
  useEffect(() => {
    if (moves) primary.current?.focus({ preventScroll: true });
  }, [moves]);

  if (!v) return <NoVerdict />;

  const order = (step: string) => {
    const i = gifts.findIndex((g) => g.id === step);
    return i < 0 ? gifts.length : i;
  };
  /** Glides to a gift or the closing view, forwards or back depending on where it is. */
  const go = (step: string, focus = true) => {
    setNav((n) => ({ step, dir: order(step) >= order(n.step) ? 1 : -1 }));
    if (focus) setMoves((m) => m + 1);
  };
  // The closing view only while both gifts are marked (a mark can be taken back, here or by the partner).
  const view = nav.step === END && next ? next.id : nav.step;
  const gift = gifts.find((g) => g.id === view);
  /** After `g` is marked: the other gift if it's still to mark, or the closing view. */
  const after = (g: Gift) =>
    gifts.find((x) => x.id !== g.id && !given[x.id])?.id ?? END;
  // Where a marked gift's card leads: the gift still to mark, or the closing view.
  const onward = next?.id ?? END;

  return (
    <PlainFrame
      back={{ to: 'home', label: 'Your challenges' }}
      aside={<SaveAsButton onClick={() => setSheet('save')} />}
    >
      <div className="flex flex-col gap-6">
        <h1 className="nx-enter pt-1">
          <ResultLine v={v} onOpen={() => setSheet('gifts')} />
        </h1>

        {openDisputes > 0 && (
          <OpenDisputesRow
            className="nx-enter -mt-2"
            count={openDisputes}
            onOpen={() => navigate('review')}
          />
        )}

        <div
          className="nx-enter flex flex-col gap-3"
          style={{ ['--nx-i' as string]: 1 } as CSSProperties}
        >
          <nav aria-label="The two gifts" className="flex flex-wrap gap-2">
            {gifts.map((g) => (
              <button
                key={g.id}
                type="button"
                className={styles.tab}
                aria-current={view === g.id ? 'step' : undefined}
                onClick={() => go(g.id, false)}
              >
                <span
                  className={cn(
                    'relative grid size-8 shrink-0 place-items-center rounded-full',
                    given[g.id]
                      ? 'bg-nx-done text-nx-surface'
                      : 'bg-nx-accent-soft text-nx-accent',
                  )}
                >
                  {given[g.id] ? (
                    <Check
                      size={17}
                      strokeWidth={3}
                      className={styles.pop}
                      aria-hidden="true"
                    />
                  ) : (
                    <GiftIcon size={17} aria-hidden="true" />
                  )}
                  {given[g.id] && burst?.id === g.id && <Burst key={burst.n} />}
                </span>
                <span className="min-w-0">
                  {formatMoney(g.amount)} to{' '}
                  {g.to.isMe ? 'you' : g.to.person.name}
                  <span className="sr-only">
                    {given[g.id]
                      ? g.to.isMe
                        ? ', received'
                        : ', given'
                      : g.to.isMe
                        ? ', not received yet'
                        : ', not given yet'}
                  </span>
                </span>
              </button>
            ))}
          </nav>

          <Glide id={view} direction={nav.dir}>
            {gift ? (
              <GiftCard
                gift={gift}
                done={!!given[gift.id]}
                buttonRef={keep}
                onOpen={() => setSheet('gifts')}
                onMark={() => {
                  mark(gift);
                  go(after(gift));
                }}
                onward={
                  next
                    ? {
                        label: giftName(next),
                        back: order(next.id) < order(gift.id),
                      }
                    : { label: 'Done', back: false }
                }
                onGoOn={() => go(onward)}
                onUnmark={() => {
                  unmark(gift);
                  setMoves((m) => m + 1);
                }}
              />
            ) : (
              <Closing
                v={v}
                buttonRef={keep}
                onStreaks={() => setSheet('streaks')}
                onBadges={() => setSheet('badges')}
                onRunAgain={runAgain}
                onStartNew={() => navigate('start')}
              />
            )}
          </Glide>
        </div>

        {gift && (
          <Button
            variant="quiet"
            icon={RotateCcw}
            className="nx-enter -mt-2 self-center"
            style={{ ['--nx-i' as string]: 2 } as CSSProperties}
            onClick={runAgain}
          >
            Run it again
          </Button>
        )}
      </div>

      <VerdictSheets page={page} />
    </PlainFrame>
  );
}

/** "Your gift to Jordan" or "Jordan’s gift to you". */
const giftName = (g: Gift) =>
  g.from.isMe
    ? `Your gift to ${g.to.person.name}`
    : `${possessive(g.from.person.name)} gift to you`;

/**
 * The result as one line: both avatars with the winner's crown, "You won, 4 points to Jordan’s 7",
 * and the challenge's name. It opens how the gifts were set.
 */
function ResultLine({ v, onOpen }: { v: VerdictView; onOpen: () => void }) {
  const won = outcome(v),
    partner = v.partner.person.name;
  const line =
    won === 'tie'
      ? `A tie, ${plural(v.me.points, 'point')} each`
      : won === 'me'
        ? `You won, ${plural(v.me.points, 'point')} to ${possessive(partner)} ${v.partner.points}`
        : `${partner} won, ${plural(v.partner.points, 'point')} to your ${v.me.points}`;
  return (
    <button
      type="button"
      className="nx-press -mx-3 flex min-h-16 w-[calc(100%+24px)] items-center gap-4 rounded-nx px-3 py-2 text-left transition-colors hover:bg-nx-accent-soft"
      aria-haspopup="dialog"
      onClick={onOpen}
    >
      <span className="flex shrink-0 items-center" aria-hidden="true">
        {[v.me, v.partner].map((s, i) => (
          <span
            key={s.person.id}
            className={cn(
              'relative',
              i > 0 && '-ml-2.5',
              v.winner === s.person.id && 'z-10',
            )}
          >
            <Avatar
              person={s.person}
              decorative
              className="shadow-[0_0_0_2.5px_var(--nx-page)]"
            />
            {v.winner === s.person.id && (
              <span
                className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full text-nx-on-accent shadow-nx-glass"
                style={{ background: 'var(--nx-fill)' }}
              >
                <Crown size={13} strokeWidth={2.4} />
              </span>
            )}
          </span>
        ))}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-nx-serif text-nx-h3 text-nx-ink">{line}</span>{' '}
        <span className="font-nx-sans text-nx-2 text-nx-ink-2">{v.name}</span>
      </span>
      <ChevronRight className="nx-row-chevron" size={22} aria-hidden="true" />
    </button>
  );
}

/**
 * One gift, large: who gives whom, "Your $10 gift to Jordan" with the amount counting up (it opens
 * how it was set), and its one main button. A marked gift says so instead, leads on, and can be
 * marked back.
 */
function GiftCard({
  gift: g,
  done,
  buttonRef,
  onOpen,
  onMark,
  onward,
  onGoOn,
  onUnmark,
}: {
  gift: Gift;
  done: boolean;
  buttonRef: (el: HTMLButtonElement | null) => void;
  onOpen: () => void;
  onMark: () => void;
  /** Where a marked gift's main button leads, and whether that's back. */
  onward: { label: string; back: boolean };
  onGoOn: () => void;
  onUnmark: () => void;
}) {
  const giving = g.from.isMe;
  return (
    <GlassCard
      as="article"
      pad="lg"
      className="flex flex-col items-center gap-5 text-center"
    >
      <HandOff gift={g} done={done} size="lg" />
      <h2 className="w-full">
        <button
          type="button"
          className="nx-press relative flex w-full flex-col items-center rounded-nx px-10 py-3 transition-colors hover:bg-nx-accent-soft"
          aria-haspopup="dialog"
          onClick={onOpen}
        >
          <ChevronRight
            className="nx-row-chevron absolute top-1/2 right-2 -translate-y-1/2"
            size={22}
            aria-hidden="true"
          />
          <span className="text-nx-h2 text-nx-ink">
            {giving ? 'Your' : possessive(g.from.person.name)}
          </span>{' '}
          <span
            className={cn(
              styles.flip,
              'my-1 text-nx-num-xl text-nx-ink tabular-nums',
            )}
            style={{ ['--delay' as string]: '60ms' } as CSSProperties}
          >
            <RevealAmount amount={g.amount} delay={180} />
          </span>{' '}
          <span className="text-nx-h2 text-nx-ink">
            {giving ? `gift to ${g.to.person.name}` : 'gift to you'}
          </span>
        </button>
      </h2>

      {done ? (
        <div className="flex w-full flex-col gap-3">
          <p
            className={cn(
              styles.settle,
              'flex min-h-12 items-center justify-center gap-3 rounded-nx-sm bg-nx-done-soft px-3 text-nx-body font-semibold text-nx-done',
            )}
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-nx-done text-nx-surface">
              <Check size={17} strokeWidth={3} aria-hidden="true" />
            </span>
            {giving ? 'Given' : 'Received'}
          </p>
          <Button
            ref={buttonRef}
            variant="primary"
            size="lg"
            full
            icon={onward.back ? ArrowLeft : undefined}
            iconEnd={onward.back ? undefined : ArrowRight}
            onClick={onGoOn}
          >
            {onward.label}
          </Button>
          <Button
            variant="quiet"
            icon={RotateCcw}
            className="self-center"
            onClick={onUnmark}
          >
            {giving ? 'Mark as not given' : 'Mark as not received'}
          </Button>
        </div>
      ) : (
        <Button
          ref={buttonRef}
          variant="primary"
          size="lg"
          full
          icon={Check}
          onClick={onMark}
        >
          {giving ? 'Mark as given' : 'Mark as received'}
        </Button>
      )}
    </GlassCard>
  );
}

/** Both gifts are done: best streaks and badges, then Run it again or start something new. */
function Closing({
  v,
  buttonRef,
  onStreaks,
  onBadges,
  onRunAgain,
  onStartNew,
}: {
  v: VerdictView;
  buttonRef: (el: HTMLButtonElement | null) => void;
  onStreaks: () => void;
  onBadges: () => void;
  onRunAgain: () => void;
  onStartNew: () => void;
}) {
  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-nx-done-soft text-nx-done">
          <CheckCheck
            size={28}
            strokeWidth={2.4}
            className={styles.pop}
            aria-hidden="true"
          />
        </span>
        <h2 className="font-nx-serif text-nx-h2">Both gifts are done</h2>
      </div>
      <div className="flex flex-col gap-3">
        <RowButton
          leading={<IconDot icon={Flame} />}
          title="Best streaks"
          detail={streakLine(v)}
          aria-haspopup="dialog"
          onClick={onStreaks}
        />
        <RowButton
          leading={<IconDot icon={Trophy} />}
          title="Badges"
          detail={badgeLine(v)}
          aria-haspopup="dialog"
          onClick={onBadges}
        />
      </div>
      <div className="flex flex-col items-center gap-2">
        <Button
          ref={buttonRef}
          variant="primary"
          size="lg"
          full
          icon={RotateCcw}
          onClick={onRunAgain}
        >
          Run it again
        </Button>
        <Button variant="quiet" icon={Plus} onClick={onStartNew}>
          Start something new
        </Button>
      </div>
    </div>
  );
}

/** A row's round icon. */
function IconDot({ icon: Icon }: { icon: typeof Flame }) {
  return (
    <span className="grid size-11 place-items-center rounded-full bg-nx-accent-soft text-nx-accent">
      <Icon size={20} aria-hidden="true" />
    </span>
  );
}
