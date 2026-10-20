// One step at a time: name and dates, rules, what a miss costs, then a check screen with Invite Jordan.
'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, PencilLine, Plus } from 'lucide-react';
import { PlainFrame } from '@/components/next/frames';
import {
  ActionBar,
  Button,
  GlassCard,
  Glide,
  NumberField,
  RowButton,
  StatButton,
  Stagger,
  TextField,
} from '@/components/next/ui';
import { formatMoney } from '@/lib/next/selectors';
import { DateField } from './fields';
import {
  MAX_DAYS,
  MIN_DAYS,
  draftDays,
  rangeLine,
  zoneCity,
  zoneRegion,
} from './draft';
import { RuleList } from './rule-list';
import { SetupSheets } from './setup-sheets';
import { StakesFields } from './stakes';
import { StepNav } from './step-nav';
import { deadlineShort, detailsLine, rulesLine, stakesLine } from './summary';
import { useSetup, type Part } from './use-setup';

const STEPS: { id: Part | 'check'; label: string; title: string }[] = [
  { id: 'details', label: 'Name', title: 'Name and dates' },
  { id: 'rules', label: 'Rules', title: 'Rules' },
  { id: 'stakes', label: 'Cost', title: 'What a miss costs' },
  { id: 'check', label: 'Check', title: 'Check and invite' },
];
const LAST = STEPS.length - 1;

/** Set up and rules, version 2. */
export default function SetupV2() {
  const setup = useSetup();
  const { world, draft, patch, errors, clear } = setup;
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const top = useRef<HTMLDivElement>(null);
  const moved = useRef(false);

  // After a step changes, the new screen starts at the top and its title takes the focus.
  useEffect(() => {
    if (!moved.current) return;
    top.current?.scrollIntoView({ block: 'start' });
    document
      .getElementById(`setup-step-${STEPS[step].id}`)
      ?.focus({ preventScroll: true });
  }, [step]);

  const go = (to: number) => {
    if (to === step) return;
    moved.current = true;
    setDirection(to > step ? 1 : -1);
    setStep(to);
  };
  const goTo = (part: Part) => go(STEPS.findIndex((s) => s.id === part));
  const current = STEPS[step];
  const next = () => {
    if (current.id !== 'check' && !setup.check(current.id)) return;
    go(step + 1);
  };

  const screens: Record<(typeof STEPS)[number]['id'], ReactNode> = {
    details: (
      <GlassCard className="flex flex-col gap-6">
        <TextField
          label="Name"
          value={draft.name}
          onChange={(name) => {
            patch({ name });
            clear('name');
          }}
          maxLength={40}
          error={errors.name}
        />
        <div className="grid items-start gap-6 sm:grid-cols-2">
          <DateField
            label="First day"
            value={draft.start}
            onChange={(start) => patch({ start })}
          />
          <NumberField
            label="Length"
            value={draft.days}
            onChange={(days) => {
              patch({ days });
              clear('days');
            }}
            unit="days"
            step={1}
            min={MIN_DAYS}
            max={MAX_DAYS}
            hint={rangeLine(draft.start, draftDays(draft))}
            error={errors.days}
          />
        </div>
      </GlassCard>
    ),
    rules: (
      <div className="flex flex-col gap-4">
        <RuleList
          rules={draft.rules}
          me={world.me}
          partner={world.partner}
          variant="actions"
          onEdit={setup.build}
          onRemove={setup.remove}
        />
        {errors.rules && (
          <p className="nx-field-error" role="alert">
            {errors.rules}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Button icon={Plus} onClick={() => setup.setOpen('library')}>
            Add a rule
          </Button>
          <Button icon={PencilLine} onClick={() => setup.build(null)}>
            Build your own
          </Button>
        </div>
      </div>
    ),
    stakes: (
      <GlassCard>
        <StakesFields
          step={draft.step}
          capOn={draft.capOn}
          cap={draft.cap}
          capError={errors.cap}
          onChange={(change) => {
            patch(change);
            clear('cap');
          }}
          readout={
            <StatButton
              glass={false}
              size="lg"
              tone="accent"
              label="Miss 1 in 10 check-ins and each gift will be about"
              value={setup.stakes.gift}
              format={formatMoney}
              hint="See how it adds up"
              onClick={() => setup.setOpen('how')}
            />
          }
        />
      </GlassCard>
    ),
    check: (
      <div className="flex flex-col gap-8">
        <Stagger className="flex flex-col gap-3">
          <RowButton
            title="Name and dates"
            detail={detailsLine(draft)}
            onClick={() => goTo('details')}
          />
          <RowButton
            title="Rules"
            detail={rulesLine(draft.rules)}
            onClick={() => goTo('rules')}
          />
          <RowButton
            title="What a miss costs"
            detail={stakesLine(draft)}
            onClick={() => goTo('stakes')}
          />
        </Stagger>
        <Stagger className="flex flex-col gap-3" start={3}>
          <RowButton
            title="Deadline"
            detail={deadlineShort(draft)}
            onClick={() => setup.setOpen('deadline')}
          />
          <RowButton
            title="Time zone"
            detail={`${zoneCity(draft.timeZone)} · ${zoneRegion(draft.timeZone)}`}
            onClick={() => setup.setOpen('zone')}
          />
        </Stagger>
      </div>
    ),
  };

  return (
    <PlainFrame back={step === 0 ? { to: 'start' } : undefined}>
      <div ref={top} className="flex scroll-mt-24 flex-col gap-8">
        <StepNav steps={STEPS} current={step} onGo={go} />
        <Glide id={current.id} direction={direction}>
          <div className="flex flex-col gap-6">
            <h1
              id={`setup-step-${current.id}`}
              tabIndex={-1}
              className="nx-page-title focus:outline-none"
            >
              {current.title}
            </h1>
            {screens[current.id]}
          </div>
        </Glide>
      </div>

      <ActionBar>
        {step === LAST ? (
          <Button
            variant="primary"
            size="lg"
            full
            iconEnd={ArrowRight}
            loading={setup.busy}
            onClick={() => setup.finish(goTo)}
          >
            {setup.finishLabel}
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            full
            iconEnd={ArrowRight}
            onClick={next}
          >
            Next
          </Button>
        )}
        {step > 0 && (
          <Button size="lg" full icon={ArrowLeft} onClick={() => go(step - 1)}>
            Back
          </Button>
        )}
      </ActionBar>

      <SetupSheets setup={setup} />
    </PlainFrame>
  );
}
