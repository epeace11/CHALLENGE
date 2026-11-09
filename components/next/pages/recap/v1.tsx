// The Monday notification comes first, as it arrived, then the score and the gifts as four big numbers and one card for each result.
'use client';
import { useBackend } from '@/components/next/backend';
import { useState } from 'react';
import {
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  Dumbbell,
  Flame,
  Trophy,
} from 'lucide-react';
import { AppFrame } from '@/components/next/frames';
import { useNav } from '@/components/next/nav';
import { useWorld } from '@/components/next/world';
import {
  ActionBar,
  Button,
  EmptyState,
  GlassCard,
  PageTitle,
  Section,
  StatButton,
  TapCard,
} from '@/components/next/ui';
import { formatMoney, plural } from '@/lib/next/selectors';
import {
  notification,
  recapAction,
  recapOf,
  shortTitle,
  type RecapView,
} from './data';
import { NotificationCard, NotificationSheet } from './notification';
import { IconBubble, WeekBar } from './parts';
import styles from './recap.module.css';

/** Monday recap, version 2. */
export default function RecapV2() {
  const world = useWorld();
  const { navigate } = useNav();
  const [notify, setNotify] = useState(true);
  // Monday notifications come with reminders, later in the live app.
  const { live } = useBackend();
  const [sheet, setSheet] = useState(false);
  const v = recapOf(world);
  const partner = world.partner.name;

  if (!v)
    return (
      <AppFrame>
        <GlassCard pad="lg" className="mt-6">
          <EmptyState
            icon={CalendarCheck}
            title="No recap yet"
            action={
              <Button variant="primary" onClick={() => navigate('overview')}>
                Back to Overview
              </Button>
            }
          >
            The first one comes the Monday after your first full week.
          </EmptyState>
        </GlassCard>
      </AppFrame>
    );

  const action = recapAction(world);
  const note = notification(world, v);
  const points = (n: number) => plural(Math.round(n), 'point');
  // The amount above is the gift as it is now, so the hint says only what last week added to it.
  const lastWeek = (dollars: number) =>
    dollars > 0
      ? `${formatMoney(dollars)} of it last week`
      : 'None of it last week';
  const wonHint = (
    <span className="inline-flex items-center gap-1.5 font-semibold text-nx-accent">
      <Trophy size={16} className={styles.pop} aria-hidden="true" />
      Won the week
    </span>
  );

  return (
    <AppFrame>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-5">
          <PageTitle title="Monday recap" detail={v.range} />
          {!live && (
            <NotificationCard
              title={note.title}
              body={note.body}
              on={notify}
              onOpen={() => setSheet(true)}
            />
          )}
        </div>

        {/* Who won is the notification's title and the trophy below, so the heading names the numbers. */}
        <Section title="Points and gifts" index={1}>
          <div className="grid grid-cols-2 gap-3">
            <StatButton
              label="You added"
              value={v.mine.points}
              format={points}
              tone={v.winner === world.me.id ? 'accent' : 'default'}
              hint={v.winner === world.me.id ? wonHint : undefined}
              onClick={() => navigate('progress')}
            />
            <StatButton
              label={`${partner} added`}
              value={v.theirs.points}
              format={points}
              tone={v.winner === world.partner.id ? 'accent' : 'default'}
              hint={v.winner === world.partner.id ? wonHint : undefined}
              onClick={() => navigate('progress')}
            />
            {/* The gifts as they are now (what Gifts shows), and how much of each last week added. */}
            <StatButton
              label="You get"
              value={v.gifts.me}
              format={formatMoney}
              hint={lastWeek(v.theirs.dollars)}
              onClick={() => navigate('progress')}
            />
            <StatButton
              label={`${partner} gets`}
              value={v.gifts.partner}
              format={formatMoney}
              hint={lastWeek(v.mine.dollars)}
              onClick={() => navigate('progress')}
            />
          </div>
        </Section>

        <Section title="Gym and streaks" index={2}>
          <div className="grid gap-3 sm:grid-cols-2">
            {v.weekly.map(({ rule, me, partner: them }) => (
              <TapCard
                key={rule.id}
                className="h-full"
                onClick={() => navigate('progress')}
              >
                <span className="flex flex-col gap-3">
                  <span className="flex items-center gap-3">
                    <IconBubble icon={Dumbbell} size={40} />
                    <span className="text-nx-body font-semibold">
                      {shortTitle(rule)}
                    </span>
                  </span>
                  <WeekBar name="You" have={me.have} need={me.need} />
                  {them && (
                    <WeekBar name={partner} have={them.have} need={them.need} />
                  )}
                </span>
              </TapCard>
            ))}
            {(v.streaks.me || v.streaks.partner) && (
              <TapCard className="h-full" onClick={() => navigate('progress')}>
                <span className="flex flex-col gap-3">
                  <span className="flex items-center gap-3">
                    <IconBubble icon={Flame} size={40} />
                    <span className="text-nx-body font-semibold">
                      Longest streaks that week
                    </span>
                  </span>
                  <StreakLine name="You" streak={v.streaks.me} />
                  <StreakLine name={partner} streak={v.streaks.partner} />
                </span>
              </TapCard>
            )}
          </div>
        </Section>

        {v.thisWeek.length > 0 && (
          <Section title="This week" index={3}>
            {v.thisWeek.map(({ rule, me, partner: them }) => (
              <TapCard key={rule.id} onClick={() => navigate('progress')}>
                <span className="flex flex-col gap-3">
                  <span className="flex items-center gap-3">
                    <IconBubble icon={CalendarDays} size={40} />
                    <span className="flex min-w-0 flex-col">
                      {/* How many it needs is in each bar ("2 of 4"), so the name doesn't say it too. */}
                      <span className="text-nx-body font-semibold">
                        {shortTitle(rule)}
                      </span>
                      <span className="text-nx-2 text-nx-ink-2">
                        {me.met
                          ? 'You are done for the week'
                          : `You need ${me.left} more, ${plural(me.daysLeft, 'day')} left`}
                      </span>
                    </span>
                  </span>
                  <WeekBar name="You" have={me.have} need={me.need} />
                  {them && (
                    <WeekBar name={partner} have={them.have} need={them.need} />
                  )}
                </span>
              </TapCard>
            ))}
          </Section>
        )}
      </div>

      <ActionBar>
        <Button
          variant="primary"
          size="lg"
          full
          iconEnd={ArrowRight}
          onClick={() => navigate(action.page)}
        >
          {action.label}
        </Button>
      </ActionBar>
      <NotificationSheet
        open={sheet}
        onOpenChange={setSheet}
        on={notify}
        onChange={setNotify}
      />
    </AppFrame>
  );
}

/** One person's longest streak at the week's end, its habit, and whether it is still going. */
function StreakLine({
  name,
  streak,
}: {
  name: string;
  streak: RecapView['streaks']['me'];
}) {
  return (
    <span className="flex items-baseline gap-3">
      <span className="w-[4.5rem] shrink-0 text-nx-2 text-nx-ink-2">
        {name}
      </span>
      {streak ? (
        <span className="flex min-w-0 flex-col">
          <span className="text-nx-body">
            <span className="font-semibold">{plural(streak.days, 'day')}</span>{' '}
            · {streak.rule.title}
          </span>
          {streak.now && (
            <span className="text-nx-2 text-nx-accent">
              {plural(streak.now, 'day')} now, still going
            </span>
          )}
        </span>
      ) : (
        <span className="text-nx-body text-nx-ink-2">None</span>
      )}
    </span>
  );
}
