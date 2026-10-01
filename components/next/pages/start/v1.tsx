// Four long rows, one under the other: Create new challenge (filled), Say your rules, Saved challenges, Themes; the last two glide to their list.
'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Mic,
  Plus,
  type LucideIcon,
} from 'lucide-react';
import { PlainFrame } from '@/components/next/frames';
import { useNav } from '@/components/next/nav';
import { useWorld } from '@/components/next/world';
import { Button, Glide, PageTitle, Stagger } from '@/components/next/ui';
import { ChoiceSheet } from './choice-sheet';
import { useChoiceSheet } from './use-choice-sheet';
import { savedChoices, themeChoices, type Choice } from './choices';
import { ChoiceRow } from './parts';
import styles from './start.module.css';
import { cx } from './cx';

type Step = 'how' | 'themes' | 'saved';

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'];
/** "Four": small counts read better as words in a sentence. */
const countWord = (n: number) => WORDS[n] ?? String(n);

/** Start a challenge. */
export default function Start() {
  const world = useWorld();
  const { navigate } = useNav();
  const sheet = useChoiceSheet();
  const [step, setStep] = useState<Step>('how');
  const [direction, setDirection] = useState<1 | -1>(1);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  const themes = themeChoices(world);
  const saved = savedChoices(world);

  const go = (next: Step) => {
    moved.current = true;
    setDirection(next === 'how' ? -1 : 1);
    setStep(next);
  };
  // After moving between steps, keyboard and screen reader users land on the new step's heading.
  useEffect(() => {
    if (moved.current) heading.current?.focus({ preventScroll: true });
  }, [step]);

  return (
    <PlainFrame back={{ to: 'home', label: 'Your challenges' }}>
      <div className="flex flex-col gap-6 pb-6">
        <PageTitle
          title="Start a challenge"
          detail={`With ${world.partner.name}`}
        />
        <Glide id={step} direction={direction}>
          {step === 'how' ? (
            <Stagger as="ul" className="flex flex-col gap-3">
              <StartRow
                filled
                title="Create new challenge"
                detail="Pick each rule yourself"
                icon={Plus}
                onClick={() => navigate('setup')}
              />
              <StartRow
                title="Say your rules"
                detail="Say them in one sentence"
                icon={Mic}
                onClick={() => navigate('say')}
              />
              <StartRow
                title="Saved challenges"
                detail={saved.map((s) => s.name).join(' or ')}
                icon={Bookmark}
                onClick={() => go('saved')}
              />
              <StartRow
                title="Themes"
                detail={`${countWord(themes.length)} ready-made challenges`}
                art={<ThemeDots choices={themes} />}
                onClick={() => go('themes')}
              />
            </Stagger>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <Button
                  variant="quiet"
                  icon={ChevronLeft}
                  className="-ml-3"
                  onClick={() => go('how')}
                >
                  All ways to start
                </Button>
                <h2
                  ref={heading}
                  tabIndex={-1}
                  className="nx-section-title mt-1 outline-none"
                >
                  {step === 'themes'
                    ? 'Pick a theme'
                    : 'Pick a saved challenge'}
                </h2>
              </div>
              <Stagger as="ul" className="flex flex-col gap-3">
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
