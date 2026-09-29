// Version 2: how it works as four short lines with icons, then the main action; the themes as rows, beside it on laptops.
'use client';
import { ArrowRight, CircleHelp, Ticket } from 'lucide-react';
import { PlainFrame } from '@/components/next/frames';
import { useWorld } from '@/components/next/world';
import {
  Button,
  Enter,
  RowButton,
  Section,
  Stagger,
} from '@/components/next/ui';
import { STEPS, themeFacts } from './content';
import { HeroTitle } from './hero-title';
import { HowItWorksSheet } from './how-it-works';
import { ThemeIcon } from './themes';
import { useLanding } from './use-landing';

/** Landing page, version 2. */
export default function LandingV2() {
  const world = useWorld();
  const { start, signIn, invite, how, setHow } = useLanding();

  return (
    <PlainFrame
      width="wide"
      aside={
        <Button variant="quiet" className="-mr-3" onClick={signIn}>
          Sign in
        </Button>
      }
    >
      <div className="grid gap-10 pt-4 pb-6 sm:pt-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start lg:gap-16 lg:pt-16">
        <div className="flex flex-col gap-7">
          <Enter>
            <HeroTitle>A habit challenge for couples</HeroTitle>
          </Enter>
          <div className="flex flex-col gap-2">
            <Stagger as="ul" className="flex flex-col gap-3 sm:gap-4" start={1}>
              {STEPS.map(({ icon: Icon, title }) => (
                <span key={title} className="flex items-center gap-4">
                  <span
                    className="grid size-10 shrink-0 place-items-center rounded-nx-sm bg-nx-accent-soft text-nx-accent sm:size-11"
                    aria-hidden="true"
                  >
                    <Icon size={20} />
                  </span>
                  <span className="text-nx-body text-nx-ink sm:text-nx-lead">
                    {title}
                  </span>
                </span>
              ))}
            </Stagger>
            <Enter index={5}>
              <Button
                variant="quiet"
                icon={CircleHelp}
                className="-ml-3"
                onClick={() => setHow(true)}
              >
                How it works
              </Button>
            </Enter>
          </div>
          <Enter
            index={6}
            className="flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Button
              variant="primary"
              size="lg"
              iconEnd={ArrowRight}
              onClick={start}
            >
              Start a challenge
            </Button>
            <Button size="lg" icon={Ticket} onClick={invite}>
              I have an invite
            </Button>
          </Enter>
        </div>

        <Section title="Or start from a theme" index={4}>
          <Stagger className="flex flex-col gap-2.5" start={5}>
            {world.themes.map((theme) => (
              <RowButton
                key={theme.id}
                data-look={theme.look}
                leading={<ThemeIcon theme={theme} />}
                title={theme.name}
                detail={themeFacts(theme)}
                onClick={start}
              />
            ))}
          </Stagger>
        </Section>
      </div>

      <HowItWorksSheet open={how} onOpenChange={setHow} onStart={start} />
    </PlainFrame>
  );
}
