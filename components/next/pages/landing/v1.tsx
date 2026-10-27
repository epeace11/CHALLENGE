// How it works as four short lines with icons, then the main action; then the themes as small tiles,
// two to a row, so the whole page fits on one screen, phones included.
'use client';
import { ArrowRight, CircleHelp, Ticket } from 'lucide-react';
import { PlainFrame } from '@/components/next/frames';
import { useWorld } from '@/components/next/world';
import { Button, Enter, Stagger } from '@/components/next/ui';
import { STEPS, themeFacts } from './content';
import { HeroTitle } from './hero-title';
import { HowItWorksSheet } from './how-it-works';
import { ThemeTile } from './themes';
import { useLanding } from './use-landing';

/** Landing page, version 2. */
export default function LandingV2() {
  const world = useWorld();
  const { start, signIn, invite, canOpenInvite, how, setHow } = useLanding();

  return (
    <PlainFrame
      aside={
        <Button variant="quiet" className="-mr-3" onClick={signIn}>
          Sign in
        </Button>
      }
    >
      <div className="grid gap-5 sm:gap-8 sm:pt-4">
        <div className="flex flex-col gap-4 sm:gap-6">
          <Enter>
            <HeroTitle>A habit challenge for couples</HeroTitle>
          </Enter>
          <div className="flex flex-col gap-1">
            <Stagger
              as="ul"
              className="flex flex-col gap-2 sm:gap-2.5"
              start={1}
            >
              {STEPS.map(({ icon: Icon, title }) => (
                <span key={title} className="flex items-center gap-4">
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-nx-sm bg-nx-accent-soft text-nx-accent sm:size-10"
                    aria-hidden="true"
                  >
                    <Icon size={18} />
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
            {canOpenInvite && (
              <Button size="lg" icon={Ticket} onClick={invite}>
                I have an invite
              </Button>
            )}
          </Enter>
        </div>

        <Enter index={4}>
          <section
            className="flex flex-col gap-2.5"
            aria-labelledby="landing-themes"
          >
            <h2
              id="landing-themes"
              className="text-nx-2 text-nx-ink-2 sm:text-nx-body"
            >
              Or start from a theme
            </h2>
            <Stagger className="grid grid-cols-2 gap-2.5" start={5}>
              {world.themes.map((theme) => (
                <ThemeTile
                  key={theme.id}
                  theme={theme}
                  facts={themeFacts(theme)}
                  onClick={start}
                />
              ))}
            </Stagger>
          </section>
        </Enter>
      </div>

      <HowItWorksSheet open={how} onOpenChange={setHow} onStart={start} />
    </PlainFrame>
  );
}
