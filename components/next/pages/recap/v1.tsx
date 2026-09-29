// Version 1: the winner as the headline, then one tappable line per result with both of you side by side; this week and the Monday notification follow.
'use client';
import { useState, type ReactNode } from 'react';
import {
  ArrowRight,
  CalendarCheck,
  ChevronRight,
  Dumbbell,
  Flame,
  Gift,
  Trophy,
} from 'lucide-react';
import { AppFrame } from '@/components/next/frames';
import { useNav } from '@/components/next/nav';
import { useWorld } from '@/components/next/world';
import {
  Button,
  EmptyState,
  GlassCard,
  PageTitle,
  RowButton,
  Section,
  Stagger,
} from '@/components/next/ui';
import { formatMoney, plural } from '@/lib/next/selectors';
import {
  headline,
  notification,
  recapAction,
  recapOf,
  shortTitle,
  type RecapView,
} from './data';
import { NotificationCard, NotificationSheet } from './notification';
import { IconBubble, WeekBar } from './parts';

/** Monday recap, version 1. */
export default function RecapV1() {
  const world = useWorld();
  const { navigate } = useNav();
  const [notify, setNotify] = useState(true);
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
  const won = (personId: string) => v.winner === personId;
  const sameStreak =
    v.streaks.me &&
    v.streaks.partner &&
    v.streaks.me.rule.id === v.streaks.partner.rule.id;

  return (
    <AppFrame>
      <div className="flex flex-col gap-10 pb-4">
        <PageTitle
          kicker={`Monday recap · ${v.range}`}
          title={headline(world, v)}
          detail="Fewer points wins the week."
        />

        <Section index={1} className="-mt-2">
          <Stagger className="flex flex-col gap-2.5">
            <RowButton
              leading={<IconBubble icon={Trophy} />}
              title="Points added"
              detail={
                <Pair
                  me={{
                    value: plural(v.mine.points, 'point'),
                    strong: won(world.me.id),
                  }}
                  partner={{
                    label: partner,
                    value: plural(v.theirs.points, 'point'),
                    strong: won(world.partner.id),
                  }}
                />
              }
              onClick={() => navigate('gifts')}
            />
            <RowButton
              leading={<IconBubble icon={Gift} />}
              title="Gifts now"
              detail={
                <Pair
                  me={{ label: 'You get', value: formatMoney(v.gifts.me) }}
                  partner={{
                    label: `${partner} gets`,
                    value: formatMoney(v.gifts.partner),
                  }}
                />
              }
              onClick={() => navigate('gifts')}
            />
            {v.weekly.map(({ rule, me, partner: them }) => (
              <RowButton
                key={rule.id}
                leading={<IconBubble icon={Dumbbell} />}
                title={shortTitle(rule)}
                detail={
                  <Pair
                    me={{
                      value: `${me.have} of ${me.need}`,
                      strong: me.have >= me.need,
                    }}
                    partner={{
                      label: partner,
                      value: them ? `${them.have} of ${them.need}` : 'None',
                      strong: !!them && them.have >= them.need,
                    }}
                  />
                }
                onClick={() => navigate('progress')}
              />
            ))}
            {(v.streaks.me || v.streaks.partner) && (
              <RowButton
                leading={<IconBubble icon={Flame} />}
                title="Longest streaks"
                detail={
                  <>
                    {sameStreak && v.streaks.me && (
                      <span className="block">{v.streaks.me.rule.title}</span>
                    )}
                    <Pair
                      me={{
                        value: v.streaks.me
                          ? plural(v.streaks.me.days, 'day')
                          : 'None',
                        note: streakNote(v.streaks.me, !sameStreak),
                      }}
                      partner={{
                        label: partner,
                        value: v.streaks.partner
                          ? plural(v.streaks.partner.days, 'day')
                          : 'None',
                        note: streakNote(v.streaks.partner, !sameStreak),
                      }}
                    />
                  </>
                }
                onClick={() => navigate('progress')}
              />
            )}
          </Stagger>
        </Section>

        {v.thisWeek.length > 0 && (
          <Section title="This week" index={2}>
            <GlassCard className="flex flex-col gap-4">
              {v.thisWeek.map(({ rule, me, partner: them }) => (
                <button
                  key={rule.id}
                  type="button"
                  className="nx-card nx-tappable flex-col items-stretch gap-3 p-4"
                  onClick={() => navigate('progress')}
                >
                  <span className="flex items-center gap-3">
                    <span className="flex-1 text-nx-body font-semibold">
                      {shortTitle(rule)}, {me.need} times each
                    </span>
                    <ChevronRight
                      className="nx-row-chevron"
                      size={22}
                      aria-hidden="true"
                    />
                  </span>
                  <WeekBar name="You" have={me.have} need={me.need} />
                  {them && (
                    <WeekBar name={partner} have={them.have} need={them.need} />
                  )}
                </button>
              ))}
              <Button
                variant="primary"
                size="lg"
                full
                iconEnd={ArrowRight}
                onClick={() => navigate(action.page)}
              >
                {action.label}
              </Button>
            </GlassCard>
          </Section>
        )}

        <Section title="Monday notification" index={3}>
          <NotificationCard
            title={note.title}
            body={note.body}
            on={notify}
            onOpen={() => setSheet(true)}
          />
        </Section>
      </div>
      <NotificationSheet
        open={sheet}
        onOpenChange={setSheet}
        on={notify}
        onChange={setNotify}
      />
    </AppFrame>
  );
}

/** Under a streak: its habit when the two differ, and whether it is still going. */
function streakNote(
  s: RecapView['streaks']['me'],
  withRule: boolean,
): string | undefined {
  if (!s) return undefined;
  const going = s.now ? `Still going: ${plural(s.now, 'day')}` : undefined;
  return withRule ? [s.rule.title, going].filter(Boolean).join('. ') : going;
}

type Side = {
  label?: string;
  value: ReactNode;
  /** The better result of the two. */
  strong?: boolean;
  /** One short line under the value. */
  note?: string;
};

/** You and your partner side by side inside a row. */
function Pair({ me, partner }: { me: Side; partner: Side }) {
  return (
    <span className="mt-1.5 grid grid-cols-2 gap-3">
      {[{ label: 'You', ...me }, partner].map((s, i) => (
        <span key={i} className="flex min-w-0 flex-col">
          <span className="text-nx-2 text-nx-ink-2">{s.label}</span>
          <span
            className={`font-nx-serif text-nx-h3 ${s.strong ? 'text-nx-accent' : 'text-nx-ink'}`}
          >
            {s.value}
          </span>
          {s.note && <span className="text-nx-2 text-nx-ink-2">{s.note}</span>}
        </span>
      ))}
    </span>
  );
}
