// Version 1: the whole page wears the challenge's own look; its length and what misses cost come first as two big numbers, then the rules, with Start pinned to the bottom.
'use client';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { PlainFrame } from '@/components/next/frames';
import { useNav } from '@/components/next/nav';
import { useWorld } from '@/components/next/world';
import {
  ActionBar,
  Button,
  RowButton,
  Section,
  Stagger,
  StatButton,
} from '@/components/next/ui';
import { plural } from '@/lib/next/selectors';
import {
  LookLabel,
  RuleIcon,
  SaveButton,
  SharedBy,
  SharedSheets,
} from './details';
import { costExample, costSequence, ruleFacts, sharedChallenge } from './facts';
import { useSaveForLater } from './use-save-for-later';

const days = (n: number) => plural(Math.round(n), 'day');

/** Shared challenge link, version 1. */
export default function SharedV1() {
  const world = useWorld();
  const { navigate } = useNav();
  const shared = sharedChallenge(world);
  const { saved, toggle } = useSaveForLater(shared.name);
  const [sheet, setSheet] = useState<string | null>(null);
  const start = () => {
    setSheet(null);
    navigate('setup');
  };

  return (
    <PlainFrame>
      <div data-look={shared.look} className="flex flex-col gap-8 pt-3 sm:pt-8">
        <header className="nx-enter flex flex-col gap-3">
          <SharedBy by={shared.sharedBy} />
          <h1 className="nx-page-title">{shared.name}</h1>
          <LookLabel look={shared.look} />
        </header>

        <Section index={1}>
          <div className="grid gap-3 sm:grid-cols-2">
            <StatButton
              label="Length"
              value={shared.days}
              format={days}
              hint="Starts the day you pick"
              onClick={() => setSheet('length')}
            />
            <StatButton
              label="What misses cost"
              value={costSequence(shared.step)}
              tone="accent"
              hint={costExample(shared)}
              onClick={() => setSheet('cost')}
            />
          </div>
        </Section>

        <Section title="Rules" index={2}>
          <Stagger className="flex flex-col gap-2.5" start={3}>
            {shared.rules.map((rule) => (
              <RowButton
                key={rule.id}
                leading={<RuleIcon rule={rule} />}
                title={rule.title}
                detail={ruleFacts(rule)}
                onClick={() => setSheet(rule.id)}
              />
            ))}
          </Stagger>
        </Section>

        <ActionBar className="mt-0">
          <Button
            variant="primary"
            size="lg"
            full
            iconEnd={ArrowRight}
            onClick={start}
          >
            Start this challenge
          </Button>
          <SaveButton saved={saved} onClick={toggle} size="lg" />
        </ActionBar>
      </div>

      <SharedSheets
        shared={shared}
        today={world.today}
        open={sheet}
        onClose={() => setSheet(null)}
        onStart={start}
        look={shared.look}
      />
    </PlainFrame>
  );
}
