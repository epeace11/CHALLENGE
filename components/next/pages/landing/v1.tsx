// Version 1: one column: what it is in two plain sentences, the main action right under them, then the four themes as a grid of cards.
'use client';
import { ArrowRight, CircleHelp, Ticket } from 'lucide-react';
import { PlainFrame } from '@/components/next/frames';
import { useWorld } from '@/components/next/world';
import { Button, Enter, Section, Stagger } from '@/components/next/ui';
import { HeroTitle } from './hero-title';
import { HowItWorksSheet } from './how-it-works';
import { ThemeTile } from './themes';
import { useLanding } from './use-landing';

/** Landing page, version 1. */
export default function LandingV1() {
  const world = useWorld();
  const { start, signIn, invite, how, setHow } = useLanding();

  return (
    <PlainFrame
      aside={
        <Button variant="quiet" className="-mr-3" onClick={signIn}>
          Sign in
        </Button>
      }
    >
      <div className="flex flex-col gap-9 pt-4 pb-6 sm:pt-12">
        <header className="flex flex-col gap-5">
          <Enter>
            <HeroTitle>A habit challenge for couples</HeroTitle>
          </Enter>
          <Enter index={1}>
            <p className="max-w-[34em] text-nx-lead text-nx-ink-2">
              Set rules together and check in every day. Your partner checks
              your answers, and each miss adds to the gift you owe them.
            </p>
          </Enter>
          <Enter index={2} className="mt-2 flex flex-col gap-2">
            <Button
              variant="primary"
              size="lg"
              iconEnd={ArrowRight}
              className="w-full sm:w-auto sm:self-start"
              onClick={start}
            >
              Start a challenge
            </Button>
            <div className="-ml-3 flex flex-wrap gap-x-2">
              <Button variant="quiet" icon={Ticket} onClick={invite}>
                I have an invite
              </Button>
              <Button
                variant="quiet"
                icon={CircleHelp}
                onClick={() => setHow(true)}
              >
                How it works
              </Button>
            </div>
          </Enter>
        </header>

        <Section title="Or start from a theme" index={3}>
          <Stagger
            className="grid auto-rows-fr grid-cols-2 gap-3 md:grid-cols-4"
            start={4}
          >
            {world.themes.map((theme) => (
              <ThemeTile key={theme.id} theme={theme} onClick={start} />
            ))}
          </Stagger>
        </Section>
      </div>

      <HowItWorksSheet open={how} onOpenChange={setHow} onStart={start} />
    </PlainFrame>
  );
}
