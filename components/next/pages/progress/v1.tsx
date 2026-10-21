// Original order: the whole challenge first, then each habit worst first, then the simple month with its own You / Jordan switch, then badges.
'use client';
import styles from './progress.module.css';
import { AppFrame } from '@/components/next/frames';
import { PageTitle, Section } from '@/components/next/ui';
import { useDetail } from './detail';
import { DetailSheet } from './detail-sheet';
import {
  BadgesBoth,
  ByHabit,
  CalendarCard,
  CalendarSwitch,
  MainAction,
  WholeChallenge,
  useCalendar,
} from './parts';

/** Progress, version 1. */
export default function ProgressV1() {
  const detail = useDetail();
  const cal = useCalendar();
  return (
    <AppFrame>
      <div className={`flex flex-col gap-8 ${styles.calm}`}>
        <div className="flex flex-col gap-5">
          <PageTitle title="Progress" />
          <MainAction />
        </div>
        <Section title="The whole challenge" index={1}>
          <WholeChallenge cal={cal} />
        </Section>
        <Section title="By habit, worst first" index={2}>
          <ByHabit detail={detail} />
        </Section>
        <Section title="Calendar" index={3}>
          <CalendarCard
            cal={cal}
            detail={detail}
            top={<CalendarSwitch cal={cal} />}
          />
        </Section>
        <Section title="Badges" index={4}>
          <BadgesBoth detail={detail} />
        </Section>
      </div>
      <DetailSheet detail={detail} bothPeople />
    </AppFrame>
  );
}
