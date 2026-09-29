// Say first: saying your rules leads as the one filled button, then saved challenges and themes as compact rows, and a plain Start blank last.
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

        {/* The one main action: the whole card is the filled button. */}
        <Enter index={1}>
          <Button
            variant="primary"
            size="lg"
            full
            className="min-h-[120px] justify-start rounded-nx-lg pt-5 pr-5 pb-5 pl-5 text-left whitespace-normal sm:pt-6 sm:pr-6 sm:pb-6 sm:pl-6 [&>.nx-btn-label]:min-w-0 [&>.nx-btn-label]:flex-1"
            onClick={() => navigate('say')}
          >
            <span className="flex items-center gap-4 sm:gap-5">
              <span
                className="grid size-14 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--nx-on-accent)_18%,transparent)]"
                aria-hidden="true"
              >
                <Mic size={28} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="font-nx-serif text-nx-h2 font-normal">
                  Say your rules
                </span>
                <span className="text-nx-body font-normal">
                  Say what you both want in one sentence, then check the rules
                  it drafts.
                </span>
              </span>
              <ChevronRight size={24} className="shrink-0" aria-hidden="true" />
            </span>
          </Button>
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
