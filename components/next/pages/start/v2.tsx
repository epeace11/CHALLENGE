// Say first: saying your rules leads as one big card, then saved challenges and themes as compact rows, and a plain Start blank last.
'use client';
import { ChevronRight, Mic, Plus } from 'lucide-react';
import { PlainFrame } from '@/components/next/frames';
import { useNav } from '@/components/next/nav';
import { useWorld } from '@/components/next/world';
import {
  Button,
  Enter,
  PageTitle,
  Section,
  Stagger,
} from '@/components/next/ui';
import { ChoiceSheet } from './choice-sheet';
import { useChoiceSheet } from './use-choice-sheet';
import { savedChoices, themeChoices } from './choices';
import { ChoiceRow } from './parts';
import styles from './start.module.css';
import { cx } from './cx';

/** Start a challenge, version 2. */
export default function StartV2() {
  const world = useWorld();
  const { navigate } = useNav();
  const sheet = useChoiceSheet();
  const themes = themeChoices(world);
  const saved = savedChoices(world);
  return (
    <PlainFrame back={{ to: 'home', label: 'Your challenges' }}>
      <div className="flex flex-col gap-9 pb-6">
        <PageTitle
          title="Start a challenge"
          detail={`Pick how to start with ${world.partner.name}. You can change the rules, dates and stakes next.`}
        />

        <Enter index={1}>
          <button
            type="button"
            className="nx-glass nx-tappable items-center gap-4 border-nx-accent-line p-5 sm:gap-5 sm:p-6"
            onClick={() => navigate('say')}
          >
            <span
              className={cx(styles.swatch, 'rounded-full')}
              data-size="lg"
              aria-hidden="true"
            >
              <Mic size={28} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="font-nx-serif text-nx-h2 text-nx-ink">
                Say your rules
              </span>
              <span className="text-nx-body text-nx-ink-2">
                Say what you both want in one sentence, then check the rules it
                drafts.
              </span>
            </span>
            <ChevronRight
              className="nx-row-chevron"
              size={24}
              aria-hidden="true"
            />
          </button>
        </Enter>

        <Section title="Saved challenges" index={2}>
          <Stagger as="ul" className="flex flex-col gap-2.5" start={3}>
            {saved.map((s) => (
              <ChoiceRow key={s.id} choice={s} onOpen={() => sheet.show(s)} />
            ))}
          </Stagger>
        </Section>

        <Section title="Themes" index={5}>
          <Stagger as="ul" className="flex flex-col gap-2.5" start={6}>
            {themes.map((t) => (
              <ChoiceRow key={t.id} choice={t} onOpen={() => sheet.show(t)} />
            ))}
          </Stagger>
        </Section>

        <Enter index={10} className="flex justify-center">
          <Button variant="quiet" icon={Plus} onClick={() => navigate('setup')}>
            Start blank
          </Button>
        </Enter>
      </div>
      <ChoiceSheet
        open={sheet.open}
        choice={sheet.choice}
        onOpenChange={sheet.onOpenChange}
      />
    </PlainFrame>
  );
}
