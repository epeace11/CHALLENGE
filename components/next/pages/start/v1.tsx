// Four long rows, one under the other: Create new challenge (filled), Say your rules, Saved challenges, Themes; the last two glide to their list.
'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Bookmark,
  ChevronRight,
  MessageSquareText,
  Plus,
  type LucideIcon,
} from 'lucide-react';
import { AccountMenu, PlainFrame } from '@/components/next/frames';
import { useBackend } from '@/components/next/backend';
import { useNav } from '@/components/next/nav';
import { useWorld } from '@/components/next/world';
import { Glide, PageTitle, Stagger } from '@/components/next/ui';
import { ChoiceSheet } from './choice-sheet';
import { WhoWith } from './who-with';
import { useChoiceSheet } from './use-choice-sheet';
import { savedChoices, themeChoices, type Choice } from './choices';
import { ChoiceRow } from './parts';
import styles from './start.module.css';
import { cx } from './cx';
import { forgetWantedTheme, wantedTheme } from './wanted';

type Step = 'how' | 'themes' | 'saved';

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'];
/** "Four": small counts read better as words in a sentence. */
const countWord = (n: number) => WORDS[n] ?? String(n);

/** Start a challenge. */
export default function Start() {
  const world = useWorld();
  const { navigate } = useNav();
  const { host } = useBackend();
  const themes = themeChoices(world);
  // A theme tapped on the landing page before signing up opens here, on its sheet over the themes.
  const [wanted] = useState(
    () => themes.find((t) => t.id === wantedTheme()) ?? null,
  );
  const sheet = useChoiceSheet(wanted);
  const [step, setStep] = useState<Step>(wanted ? 'themes' : 'how');
  const [direction, setDirection] = useState<1 | -1>(1);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  const saved = savedChoices(world);
  // Who it's with: anyone this person already does challenges with, or someone new.
  const partners = world.partners;
  const [who, setWho] = useState(() =>
    partners.some((p) => p.coupleId === world.couple.id)
      ? world.couple.id
      : (partners[0]?.coupleId ?? 'new'),
  );
  const chosen = partners.find((p) => p.coupleId === who)?.person;
  // Without a partner yet, a first challenge is with someone new: nothing to choose.
  const couple = partners.length ? who : undefined;
  /** A new account: nothing to go back to yet. */
  const brandNew =
    !!host && !world.challenge.id && !world.past.length && !world.saved.length;

  const go = (next: Step) => {
    moved.current = true;
    setDirection(next === 'how' ? -1 : 1);
    setStep(next);
  };
  useEffect(forgetWantedTheme, []);
  // After moving between steps, keyboard and screen reader users land on the new step's heading.
  useEffect(() => {
    if (moved.current) heading.current?.focus({ preventScroll: true });
  }, [step]);

  return (
    <PlainFrame
      // In a list, the one back goes to all ways to start. A new account has no challenges yet (the
      // live app's blank one has no id), so the ways to start have no way back.
      back={
        step !== 'how'
          ? { label: 'All ways to start', onClick: () => go('how') }
          : brandNew
            ? undefined
            : { to: 'home', label: 'Your challenges' }
      }
      aside={<AccountMenu />}
    >
      <div className="flex flex-col gap-6">
        <PageTitle
          title="Start a challenge"
          detail={partners.length ? undefined : `With ${world.partner.name}`}
        />
        {partners.length > 0 && step === 'how' && (
          <WhoWith value={who} onChange={setWho} partners={partners} />
        )}
        {partners.length > 0 && step !== 'how' && (
          <p className="-mt-3 text-nx-body text-nx-ink-2">
            {chosen ? `With ${chosen.name}` : 'With someone new'}
          </p>
        )}
        <Glide id={step} direction={direction}>
          {step === 'how' ? (
            <div className="flex flex-col gap-4">
              <Stagger as="ul" className="flex flex-col gap-3">
                <StartRow
                  filled
                  title="Create new challenge"
                  detail="Pick each rule yourself"
                  icon={Plus}
                  onClick={() =>
                    host
                      ? void host.startFrom({ kind: 'blank' }, couple)
                      : navigate('setup')
                  }
                />
                {/* Say your rules needs the AI step, which the live app adds later. */}
                {!host && (
                  <StartRow
                    title="Say your rules"
                    detail="Type or dictate them in a sentence"
                    icon={MessageSquareText}
                    onClick={() => navigate('say')}
                  />
                )}
                {saved.length > 0 && (
                  <StartRow
                    title="Saved challenges"
                    detail={saved.map((s) => s.name).join(' or ')}
                    icon={Bookmark}
                    onClick={() => go('saved')}
                  />
                )}
                <StartRow
                  title="Themes"
                  detail={`${countWord(themes.length)} ready-made challenges`}
                  art={<ThemeDots choices={themes} />}
                  onClick={() => go('themes')}
                />
              </Stagger>
              {/* A brand-new account may belong to a partner who registered before opening the link. */}
              {brandNew && (
                <p className="text-nx-2 text-nx-ink-2">
                  Joining your partner’s challenge? Open the invite link they
                  sent you.
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <h2
                ref={heading}
                tabIndex={-1}
                className="nx-section-title outline-none"
              >
                {step === 'themes' ? 'Pick a theme' : 'Pick a saved challenge'}
              </h2>
              {/* Two to a row from 640px, so four themes fit a short laptop window. */}
              <Stagger as="ul" className="grid gap-3 sm:grid-cols-2">
                {(step === 'themes' ? themes : saved).map((c) => (
                  <ChoiceRow
                    key={c.id}
                    choice={c}
                    size="lg"
                    onOpen={() => sheet.show(c)}
                  />
                ))}
              </Stagger>
            </div>
          )}
        </Glide>
      </div>
      <ChoiceSheet
        couple={couple}
        open={sheet.open}
        choice={sheet.choice}
        onOpenChange={sheet.onOpenChange}
      />
    </PlainFrame>
  );
}

/**
 * One way to start, as a long row the full width of the page: its icon or art, a title and one
 * line. `filled` makes it the page's main action, in the accent colour.
 */
function StartRow({
  title,
  detail,
  icon: Icon,
  art,
  filled,
  onClick,
}: {
  title: string;
  detail: string;
  icon?: LucideIcon;
  art?: ReactNode;
  filled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cx(
        'nx-tappable nx-row gap-4 py-5 pl-5',
        filled ? styles.filled : 'nx-glass',
      )}
      onClick={onClick}
    >
      {art ??
        (Icon && (
          <span className={styles.dot} aria-hidden="true">
            <Icon size={24} />
          </span>
        ))}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span
          className={cx(
            'font-nx-serif text-nx-h3',
            filled ? 'text-inherit' : 'text-nx-ink',
          )}
        >
          {title}
        </span>
        <span
          className={cx('text-nx-2', filled ? 'text-inherit' : 'text-nx-ink-2')}
        >
          {detail}
        </span>
      </span>
      <ChevronRight className="nx-row-chevron" size={22} aria-hidden="true" />
    </button>
  );
}

/** The four themes' colours, overlapping. */
function ThemeDots({ choices }: { choices: Choice[] }) {
  return (
    <span className={styles.dots} aria-hidden="true">
      {choices.map((c) => (
        <span key={c.id} data-look={c.look} className={styles.stackDot} />
      ))}
    </span>
  );
}
