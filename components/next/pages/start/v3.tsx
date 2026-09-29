// Two steps: first how to start as four big tiles, then which theme or saved challenge, gliding between them.
'use client';
import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
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

/** Start a challenge, version 3. */
export default function StartV3() {
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

  const list = (choices: Choice[]) => (
    <Stagger as="ul" className="flex flex-col gap-3">
      {choices.map((c) => (
        <ChoiceRow
          key={c.id}
          choice={c}
          size="lg"
          onOpen={() => sheet.show(c)}
        />
      ))}
    </Stagger>
  );

  return (
    <PlainFrame back={{ to: 'home', label: 'Your challenges' }}>
      <div className="flex flex-col gap-8 pb-6">
        <PageTitle
          title="Start a challenge"
          detail={`With ${world.partner.name}. You can change the rules, dates and stakes next.`}
        />
        <Glide id={step} direction={direction}>
          {step === 'how' ? (
            <div className="flex flex-col gap-4">
              <StepHeading ref={heading}>How do you want to start?</StepHeading>
              <Stagger as="ul" className="grid grid-cols-2 gap-3 sm:gap-4">
                <Tile
                  title="A theme"
                  detail={`${countWord(themes.length)} ready-made challenges`}
                  art={<ThemeDots choices={themes} />}
                  onClick={() => go('themes')}
                />
                <Tile
                  title="A saved challenge"
                  detail={saved.map((s) => s.name).join(' or ')}
                  icon={Bookmark}
                  onClick={() => go('saved')}
                />
                <Tile
                  title="Say your rules"
                  detail="In one sentence"
                  icon={Mic}
                  onClick={() => navigate('say')}
                />
                <Tile
                  title="Start blank"
                  detail="Pick each rule yourself"
                  icon={Plus}
                  onClick={() => navigate('setup')}
                />
              </Stagger>
            </div>
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
                <StepHeading ref={heading}>
                  {step === 'themes'
                    ? 'Pick a theme'
                    : 'Pick a saved challenge'}
                </StepHeading>
              </div>
              {list(step === 'themes' ? themes : saved)}
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

function StepHeading({
  ref,
  children,
}: {
  ref: Ref<HTMLHeadingElement>;
  children: ReactNode;
}) {
  return (
    <h2 ref={ref} tabIndex={-1} className="nx-section-title mt-1 outline-none">
      {children}
    </h2>
  );
}

/** One way to start: a big square-ish card with its icon or art, a title and one line. */
function Tile({
  title,
  detail,
  icon: Icon,
  art,
  onClick,
}: {
  title: string;
  detail: string;
  icon?: LucideIcon;
  art?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cx('nx-glass nx-tappable gap-4 p-4 sm:p-5', styles.card)}
      onClick={onClick}
    >
      <span className="flex items-start justify-between gap-2">
        {art ??
          (Icon && (
            <span className={styles.dot} aria-hidden="true">
              <Icon size={22} />
            </span>
          ))}
        <ChevronRight
          className="nx-row-chevron mt-2.5"
          size={22}
          aria-hidden="true"
        />
      </span>
      <span className="mt-auto flex flex-col gap-1">
        <span className="font-nx-serif text-nx-h3 text-nx-ink">{title}</span>
        <span className="text-nx-2 text-nx-ink-2">{detail}</span>
      </span>
    </button>
  );
}

/** The four themes' colours, overlapping. */
function ThemeDots({ choices }: { choices: Choice[] }) {
  return (
    <span className="flex h-11 items-center" aria-hidden="true">
      {choices.map((c) => (
        <span key={c.id} data-look={c.look} className={styles.stackDot} />
      ))}
    </span>
  );
}
