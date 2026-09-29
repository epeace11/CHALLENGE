// Version 1: one step at a time. A card for each question, then Jordan's review, then the gift, gliding sideways under a step bar.
'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, RotateCcw, UserPlus } from 'lucide-react';
import { PlainFrame } from '@/components/next/frames';
import { useNav } from '@/components/next/nav';
import {
  Button,
  GlassCard,
  Glide,
  PageTitle,
  useReducedMotion,
} from '@/components/next/ui';
import {
  GiftSteps,
  HowPointsSheet,
  MissLine,
  PartnerReview,
  PhaseBar,
  PracticeBanner,
  Question,
} from './parts';
import { costButton, isAnswered, usePractice } from './script';

/** Practice day, version 1. */
export default function PracticeV1() {
  const p = usePractice();
  const { navigate } = useNav();
  const reduced = useReducedMotion();
  const [how, setHow] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const partner = p.world.partner.name;

  /** After moving on, brings the step bar back into view if the page was scrolled past it. */
  const bringUp = () => {
    moved.current = true;
    const el = top.current;
    if (el && el.getBoundingClientRect().top < 0)
      el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  };

  const step =
    p.phase === 'answer' ? `question-${p.current}` : (p.phase as string);
  const headingId = `practice-${p.run}-${step}`;

  // Keyboard and screen reader users land on the new step, not on a button that just left.
  useEffect(() => {
    if (moved.current)
      document.getElementById(headingId)?.focus({ preventScroll: true });
  }, [headingId]);

  let body: ReactNode;
  if (p.phase === 'answer') {
    const i = p.current;
    body = (
      <div className="flex flex-col gap-6">
        <Question p={p} index={i} headingId={headingId} />
        {i === 0 && (
          <p className="-mt-2 text-nx-2 text-nx-ink-2">
            Sample answers are filled in. Change any of them.
          </p>
        )}
        <Button
          variant="primary"
          size="lg"
          full
          disabled={!isAnswered(p.questions[i].rule, p.answers[i])}
          onClick={() => {
            p.save();
            bringUp();
          }}
        >
          Save
        </Button>
      </div>
    );
  } else if (p.phase === 'review') {
    body = (
      <div className="flex flex-col gap-6">
        <h2 id={headingId} tabIndex={-1} className="font-nx-serif text-nx-h2">
          {partner} reviews your answers
        </h2>
        <PartnerReview p={p} />
        <Button
          variant="primary"
          size="lg"
          full
          iconEnd={ArrowRight}
          onClick={() => {
            p.toGift();
            bringUp();
          }}
        >
          {costButton(p.result.misses.length)}
        </Button>
      </div>
    );
  } else {
    body = (
      <div className="flex flex-col gap-5">
        <MissLine p={p} headingId={headingId} />
        <GiftSteps p={p} onHow={() => setHow(true)} />
        <div className="mt-1 flex flex-col gap-2">
          <Button
            variant="primary"
            size="lg"
            full
            icon={UserPlus}
            onClick={() => navigate('invite')}
          >
            Invite {partner} for real
          </Button>
          <Button
            variant="quiet"
            icon={RotateCcw}
            onClick={() => {
              p.restart();
              bringUp();
            }}
          >
            Practice again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <PlainFrame back={{ to: 'setup' }} width="narrow">
      <div className="flex flex-col gap-5 pb-8">
        <PracticeBanner />
        <div ref={top} className="flex scroll-mt-24 flex-col gap-5">
          <PageTitle title="Practice day" />
          <PhaseBar p={p} />
        </div>
        <GlassCard pad="lg" className="nx-enter overflow-hidden">
          <Glide id={`${p.run}-${step}`}>{body}</Glide>
        </GlassCard>
      </div>
      <HowPointsSheet open={how} onOpenChange={setHow} />
    </PlainFrame>
  );
}
