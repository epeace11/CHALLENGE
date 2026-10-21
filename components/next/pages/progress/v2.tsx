// Calendar first: a You / Jordan switch and the simple month on top, then the whole challenge, each habit worst first, and badges.
'use client';
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

/** Progress, version 2. */
export default function ProgressV2() {
  const detail = useDetail();
  const cal = useCalendar();
  return (
    <AppFrame>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-5">
          <PageTitle title="Progress" />
          <MainAction />
          <CalendarSwitch cal={cal} className="nx-enter" />
        </div>
        <Section title="Calendar" index={1}>
          <CalendarCard cal={cal} detail={detail} />
        </Section>
        <Section title="The whole challenge" index={2}>
          <WholeChallenge cal={cal} />
        </Section>
        <Section title="By habit, worst first" index={3}>
          <ByHabit detail={detail} />
        </Section>
        <Section title="Badges" index={4}>
          <BadgesBoth detail={detail} />
        </Section>
      </div>
      <DetailSheet detail={detail} bothPeople />
    </AppFrame>
  );
}
