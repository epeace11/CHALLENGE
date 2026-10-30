// Focus. One question fills the screen in large type; Save stays pinned at the bottom.
'use client';
import { ArrowRight, Check, ListChecks } from 'lucide-react';
import { useNav } from '@/components/next/nav';
import { Button } from '@/components/next/ui';
import { formatWeekday } from '@/lib/next/selectors';
import { CheckinPage, type EndActionsProps, type EndProps } from './page';
import styles from './log.module.css';

export default function LogV1() {
  return <CheckinPage end={Done} endActions={DoneActions} />;
}

function Done({ ci, headingRef }: EndProps) {
  const day = ci.day ?? '';
  return (
    <section className="flex flex-col items-center gap-4 px-2 pt-10 pb-4 text-center">
      <span className={styles.doneMark} data-size="lg">
        <Check size={40} strokeWidth={2.4} aria-hidden="true" />
      </span>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="mt-2 font-nx-serif text-nx-h1 outline-none"
      >
        {formatWeekday(day)} is logged
      </h2>
      <p className="max-w-sm text-nx-lead text-nx-ink-2">
        You can change an answer until {ci.lockLabel(day)}.
      </p>
    </section>
  );
}

function DoneActions({ showAnswers }: EndActionsProps) {
  const { navigate } = useNav();
  return (
    <>
      <Button
        variant="primary"
        size="lg"
        full
        iconEnd={ArrowRight}
        className="sm:w-auto sm:min-w-56"
        onClick={() => navigate('overview')}
      >
        Go to Overview
      </Button>
      <Button icon={ListChecks} onClick={showAnswers}>
        See answers
      </Button>
    </>
  );
}
