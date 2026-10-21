// Garden palette: soft sage, rose, honey and lavender pastels (the page: whole challenge, habits worst first, calendar, badges).
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

export type Palette = 'garden' | 'jewel' | 'dusk';

/** Progress, version 1: the page in the Garden palette. Versions 2 and 3 change only the palette. */
export default function ProgressV1() {
  return <ProgressPage palette="garden" />;
}

/** Progress in one of its palettes. */
export function ProgressPage({ palette }: { palette: Palette }) {
  const detail = useDetail();
  const cal = useCalendar();
  return (
    <AppFrame>
      <div
        className={`flex flex-col gap-8 ${styles.palette}`}
        data-palette={palette}
      >
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
