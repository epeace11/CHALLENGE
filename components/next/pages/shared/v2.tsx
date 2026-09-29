// Version 2: a cover in the challenge's own colours with both actions right under it; length, what misses cost and the rules follow as rows.
'use client';
import { useState } from 'react';
import { ArrowRight, CalendarDays, Coins } from 'lucide-react';
import { PlainFrame } from '@/components/next/frames';
import { useNav } from '@/components/next/nav';
import { useWorld } from '@/components/next/world';
import {
  Button,
  Enter,
  RowButton,
  Section,
  Stagger,
} from '@/components/next/ui';
import { plural } from '@/lib/next/selectors';
import {
  IconTile,
  LookIcon,
  LookLabel,
  RuleIcon,
  SaveButton,
  SharedBy,
  SharedSheets,
} from './details';
import { costExample, costSequence, ruleFacts, sharedChallenge } from './facts';
import { useSaveForLater } from './use-save-for-later';

/** Shared challenge link, version 2. */
export default function SharedV2() {
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
        <div className="flex flex-col gap-5">
          <Enter>
            <header
              className="relative isolate overflow-hidden rounded-nx-lg border border-nx-accent-line px-6 pt-6 pb-7 sm:px-8 sm:pt-8 sm:pb-9"
              style={{
                background:
                  'linear-gradient(140deg, var(--nx-accent-soft) 10%, var(--nx-surface-2) 115%)',
              }}
            >
              <LookIcon
                look={shared.look}
                className="absolute -right-6 -bottom-8 -z-10 size-44 text-nx-accent opacity-15"
              />
              <SharedBy by={shared.sharedBy} />
              <h1 className="mt-8 nx-page-title sm:mt-12">{shared.name}</h1>
              <LookLabel look={shared.look} className="mt-2" />
            </header>
          </Enter>
          <Enter
            index={1}
            className="flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Button
              variant="primary"
              size="lg"
              iconEnd={ArrowRight}
              onClick={start}
            >
              Start this challenge
            </Button>
            <SaveButton saved={saved} onClick={toggle} size="lg" />
          </Enter>
        </div>

        <Section title="Length and cost" index={2}>
          <div className="flex flex-col gap-2.5">
            <RowButton
              leading={<IconTile icon={CalendarDays} />}
              title={plural(shared.days, 'day')}
              detail="Starts the day you pick"
              onClick={() => setSheet('length')}
            />
            <RowButton
              leading={<IconTile icon={Coins} />}
              title={`Misses cost ${costSequence(shared.step)}`}
              detail={costExample(shared)}
              onClick={() => setSheet('cost')}
            />
          </div>
        </Section>

        <Section title="Rules" index={3}>
          <Stagger className="flex flex-col gap-2.5" start={4}>
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
