'use client';
import type { ReactNode } from 'react';
import {
  CircleCheckBig,
  CircleX,
  Gift,
  HeartHandshake,
  Inbox,
  Send,
  type LucideIcon,
} from 'lucide-react';
import {
  formatMoney,
  formatTarget,
  formatWhen,
  giftTotal,
} from '@/lib/next/selectors';
import { Button, Sheet, TextField } from '@/components/next/ui';
import {
  ruleTopic,
  topicExample,
  topicOptions,
  type Topic,
} from './invite-data';
import { RuleIcon, SelectField, StepBars } from './parts';
import type { InviteFlow } from './use-invite';

/** Every sheet the invite opens. Each version renders this once. */
export function InviteSheets({ flow }: { flow: InviteFlow }) {
  return (
    <>
      <RuleSheet flow={flow} />
      <DatesSheet flow={flow} />
      <StepSheet flow={flow} />
      <HowSheet flow={flow} />
      <SuggestSheet flow={flow} />
    </>
  );
}

const onOpenChange = (flow: InviteFlow) => (open: boolean) => {
  if (!open) flow.close();
};

/** A label and its value, one row of a details list. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0">
      <dt className="text-nx-2 text-nx-ink-2">{label}</dt>
      <dd className="text-nx-body text-nx-ink">{children}</dd>
    </div>
  );
}

/* ── One rule ───────────────────────────────────────────────────────────── */

function RuleSheet({ flow }: { flow: InviteFlow }) {
  const { rule } = flow;
  const group = rule
    ? flow.groups.find((g) => g.rules.some((r) => r.id === rule.id))
    : undefined;
  const proof =
    rule?.proof === 'required'
      ? 'Needed with every answer'
      : rule?.proof === 'optional'
        ? 'Optional'
        : 'Not needed';
  return (
    <Sheet
      open={flow.sheet === 'rule'}
      onOpenChange={onOpenChange(flow)}
      title={rule?.title ?? 'Rule'}
      description={rule?.description}
      footer={
        <>
          {!flow.sent && rule && (
            <Button onClick={() => flow.suggest(ruleTopic(rule.id))}>
              Suggest a change
            </Button>
          )}
          <Button variant="primary" onClick={flow.close}>
            Close
          </Button>
        </>
      }
    >
      {rule && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3.5">
            <RuleIcon rule={rule} />
            <p className="text-nx-body text-nx-ink">{rule.question}</p>
          </div>
          <dl className="flex flex-col divide-y divide-nx-line">
            <Fact label="For">{group?.title}</Fact>
            <Fact label="When">
              {rule.kind === 'weekly'
                ? `${formatWhen(rule)}, Monday to Sunday`
                : formatWhen(rule)}
            </Fact>
            {rule.target && (
              <Fact label="Target">{formatTarget(rule.target)}</Fact>
            )}
            {rule.kind === 'weekly' && (
              <Fact label="How it counts">
                A day without it costs nothing. Each day short of{' '}
                {rule.weeklyTarget} when the week ends is a point.
              </Fact>
            )}
            <Fact label="Screenshot">{proof}</Fact>
          </dl>
        </div>
      )}
    </Sheet>
  );
}

/* ── Dates ──────────────────────────────────────────────────────────────── */

function DatesSheet({ flow }: { flow: InviteFlow }) {
  const c = flow.challenge;
  return (
    <Sheet
      open={flow.sheet === 'dates'}
      onOpenChange={onOpenChange(flow)}
      title="Dates"
      description={`${c.name} runs ${c.days} days, on ${flow.place} time.`}
      footer={
        <>
          {!flow.sent && (
            <Button onClick={() => flow.suggest('start')}>
              Suggest a different date
            </Button>
          )}
          <Button variant="primary" onClick={flow.close}>
            Close
          </Button>
        </>
      }
    >
      <dl className="flex flex-col divide-y divide-nx-line">
        <Fact label="Day 1">{flow.start}</Fact>
        <Fact label="Last day">{flow.end}</Fact>
        <Fact label="First check-in">
          For {flow.firstCheckin.day}, by {flow.firstCheckin.until}
        </Fact>
      </dl>
    </Sheet>
  );
}

/* ── The dollar step ────────────────────────────────────────────────────── */

function StepSheet({ flow }: { flow: InviteFlow }) {
  const { step } = flow.challenge;
  const n = 6;
  return (
    <Sheet
      open={flow.sheet === 'gift'}
      onOpenChange={onOpenChange(flow)}
      title={`The ${flow.step} step`}
      description="Each miss is a point, and each point costs one step more than the one before."
      footer={
        <>
          {!flow.sent && (
            <Button onClick={() => flow.suggest('step')}>
              Suggest a different step
            </Button>
          )}
          <Button variant="primary" onClick={flow.close}>
            Close
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <StepBars step={step} count={n} />
        <p className="text-nx-body text-nx-ink">
          So {n} misses cost {formatMoney(giftTotal(n, step, null))} in all.
          When it ends, each of you buys the other a gift worth your own points.
        </p>
        <p className="text-nx-body text-nx-ink-2">
          A point {flow.inviter.name} forgives costs nothing.
        </p>
      </div>
    </Sheet>
  );
}

/* ── How it works ───────────────────────────────────────────────────────── */

function HowStep({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex items-start gap-3.5">
      <span
        aria-hidden="true"
        className="grid size-10 shrink-0 place-items-center rounded-full bg-nx-accent-soft text-nx-accent"
      >
        <Icon size={20} strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1 pt-1.5">
        <h3 className="font-nx-sans text-nx-body font-semibold">{title}</h3>
        <p className="mt-0.5 text-nx-body text-nx-ink-2">{children}</p>
      </div>
    </li>
  );
}

function HowSheet({ flow }: { flow: InviteFlow }) {
  const name = flow.inviter.name;
  const [a, b, c] = flow.steps;
  return (
    <Sheet
      open={flow.sheet === 'how'}
      onOpenChange={onOpenChange(flow)}
      title="How it works"
      footer={
        <Button variant="primary" onClick={flow.close}>
          Close
        </Button>
      }
    >
      <ol className="flex flex-col gap-5">
        <HowStep icon={CircleCheckBig} title="Check in every day">
          Answer each rule for the day before, by {flow.deadline}. Some rules
          need a screenshot.
        </HowStep>
        <HowStep icon={Inbox} title="Review each other">
          Approve {name}’s answers, or dispute one and say why. {name} reviews
          yours.
        </HowStep>
        <HowStep icon={CircleX} title="Misses are points">
          A No, a missed target or a check-in not done in time is a point. Each
          point costs one step more: {a}, then {b}, then {c}.
        </HowStep>
        <HowStep icon={HeartHandshake} title="Forgiveness">
          Ask {name} to forgive a point when you had a good reason. A forgiven
          point costs nothing.
        </HowStep>
        <HowStep icon={Gift} title="The gifts">
          When it ends, each of you buys the other a gift worth your own points.
        </HowStep>
      </ol>
    </Sheet>
  );
}

/* ── Suggest a change ───────────────────────────────────────────────────── */

function SuggestSheet({ flow }: { flow: InviteFlow }) {
  const c = flow.challenge;
  const options = topicOptions(c);
  const name = flow.inviter.name;
  return (
    <Sheet
      open={flow.sheet === 'suggest'}
      onOpenChange={onOpenChange(flow)}
      title="Suggest a change"
      description={`${name} can change the challenge before Day 1.`}
      footer={
        <>
          <Button onClick={flow.close}>Cancel</Button>
          <Button variant="primary" icon={Send} onClick={flow.send}>
            Send to {name}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          flow.send();
        }}
      >
        <SelectField
          label="What to change"
          value={flow.topic}
          onChange={(value) => flow.setTopic(value as Topic)}
        >
          <optgroup label="Rules">
            {options.rules.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="The challenge">
            {options.settings.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </optgroup>
        </SelectField>
        <TextField
          label="What you would like instead"
          multiline
          rows={3}
          maxLength={280}
          value={flow.draft}
          onChange={flow.setDraft}
          placeholder={topicExample(c, flow.topic)}
          error={flow.error ?? undefined}
        />
      </form>
    </Sheet>
  );
}
