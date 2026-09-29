'use client';
import { useState } from 'react';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import type { Rule } from '@/lib/next/model';
import { formatDay, formatWeekday, openCheckins } from '@/lib/next/selectors';
import {
  Button,
  GlassCard,
  IconButton,
  PageTitle,
  Section,
  Sheet,
} from '@/components/next/ui';
import { DayAnswers, leftText } from './days';
import { DayJournal } from './journal';
import { QuestionFields, QuestionHead, SaveHint } from './question';
import type { Checkin } from './use-checkin';

/**
 * A closed day, picked from the day switcher: its answers, each of which can be changed as a late
 * answer (it counts once the partner approves it), and the way back to the day still open.
 */
export function ClosedDay({
  ci,
  onDays,
}: {
  ci: Checkin;
  /** Opens the day switcher. */
  onDays: () => void;
}) {
  const { world, me, day, partner } = ci;
  const back = ci.loggable[0];
  const rule = ci.current;
  // Keep the last check-in in the sheet while it slides away.
  const [shown, setShown] = useState<Rule | null>(rule ?? null);
  if (rule && rule.id !== shown?.id) setShown(rule);
  if (!day) return null;
  const left = back ? openCheckins(world, me, back).length : 0;
  return (
    <div className="flex flex-col gap-6 pb-2">
      <PageTitle
        kicker="Late answers"
        title={formatDay(day)}
        detail={`Closed. A change counts once ${partner} approves it.`}
        action={
          <IconButton
            icon={CalendarDays}
            label="Other days"
            aria-haspopup="dialog"
            onClick={onDays}
          />
        }
      />
      <Section index={1}>
        <GlassCard pad="sm">
          <DayAnswers ci={ci} />
        </GlassCard>
      </Section>
      {back && (
        <Section index={2}>
          <Button
            variant="primary"
            size="lg"
            full
            icon={ArrowLeft}
            onClick={() => ci.pickDay(back)}
          >
            Back to {formatWeekday(back)}
            {left > 0 ? ` (${leftText(left)})` : ''}
          </Button>
        </Section>
      )}
      <DayJournal day={day} index={3} />
      <Sheet
        open={!!rule}
        onOpenChange={(open) => {
          if (!open) ci.cancel();
        }}
        title={shown?.title ?? 'Late answer'}
        description={`${formatDay(day)}. It counts once ${partner} approves it.`}
        footer={
          shown && (
            <>
              <Button onClick={ci.cancel}>Cancel</Button>
              <Button
                variant="primary"
                disabled={!ci.canSave(shown)}
                onClick={() => ci.save(shown)}
              >
                Send late answer
              </Button>
            </>
          )
        }
      >
        {shown && (
          <div className="flex flex-col gap-6">
            <QuestionHead rule={shown} />
            <QuestionFields ci={ci} rule={shown} />
            <SaveHint ci={ci} rule={shown} />
          </div>
        )}
      </Sheet>
    </div>
  );
}
