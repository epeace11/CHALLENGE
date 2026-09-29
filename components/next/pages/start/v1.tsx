// Themes first: the four themes as big colour cards in a grid, then your saved challenges, then your own rules.
'use client';
import { Mic, Plus } from 'lucide-react';
import { PlainFrame } from '@/components/next/frames';
import { useNav } from '@/components/next/nav';
import { useWorld } from '@/components/next/world';
import { PageTitle, Section, Stagger } from '@/components/next/ui';
import { ChoiceSheet } from './choice-sheet';
import { useChoiceSheet } from './use-choice-sheet';
import { savedChoices, themeChoices } from './choices';
import { ChoiceRow, OwnCard, ThemeCard } from './parts';

/** Start a challenge, version 1. */
export default function StartV1() {
  const world = useWorld();
  const { navigate } = useNav();
  const sheet = useChoiceSheet();
  const themes = themeChoices(world);
  const saved = savedChoices(world);
  return (
    <PlainFrame back={{ to: 'home', label: 'Your challenges' }} width="wide">
      <div className="flex flex-col gap-10 pb-6">
        <PageTitle
          kicker={`With ${world.partner.name}`}
          title="Start a challenge"
          detail="Pick a starting point. You can change the rules, dates and stakes next."
        />

        <Section title="Themes" index={1}>
          <Stagger
            as="ul"
            className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
            start={2}
          >
            {themes.map((t) => (
              <ThemeCard key={t.id} choice={t} onOpen={() => sheet.show(t)} />
            ))}
          </Stagger>
        </Section>

        <Section title="Saved challenges" index={3}>
          <Stagger as="ul" className="grid gap-3 md:grid-cols-2" start={4}>
            {saved.map((s) => (
              <ChoiceRow key={s.id} choice={s} onOpen={() => sheet.show(s)} />
            ))}
          </Stagger>
        </Section>

        <Section title="Your own rules" index={5}>
          <Stagger className="grid gap-3 md:grid-cols-2" start={6}>
            <OwnCard
              icon={Mic}
              title="Say your rules"
              detail="Say them in a sentence, then check the draft."
              onClick={() => navigate('say')}
            />
            <OwnCard
              icon={Plus}
              title="Start blank"
              detail="Pick each rule from the library."
              onClick={() => navigate('setup')}
            />
          </Stagger>
        </Section>
      </div>
      <ChoiceSheet
        open={sheet.open}
        choice={sheet.choice}
        onOpenChange={sheet.onOpenChange}
      />
    </PlainFrame>
  );
}
