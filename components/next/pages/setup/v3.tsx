// Checklist: the four things to settle as big rows with their current value; tap one to open it in place.
'use client';
import { useId, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  ChevronDown,
  CircleCheck,
  CircleDashed,
  PencilLine,
  Plus,
} from 'lucide-react';
import { PlainFrame } from '@/components/next/frames';
import {
  ActionBar,
  Button,
  DURATION,
  EASE,
  GlassCard,
  NumberField,
  PageTitle,
  Presence,
  SegmentedControl,
  StatButton,
  Stagger,
  TextField,
  motion,
  useReducedMotion,
} from '@/components/next/ui';
import { formatMoney } from '@/lib/next/selectors';
import { cn } from '@/lib/utils';
import { DateField, Labeled } from './fields';
import {
  DEADLINES,
  MAX_DAYS,
  MIN_DAYS,
  deadlineId,
  deadlineLine,
  draftDays,
  rangeLine,
  zoneCity,
  zoneRegion,
} from './draft';
import { RuleList } from './rule-list';
import { SetupSheets } from './setup-sheets';
import { StakesFields } from './stakes';
import {
  deadlineZoneLine,
  detailsLine,
  rulesLine,
  stakesLine,
} from './summary';
import { partReady, useSetup, type Part } from './use-setup';

type Key = Part | 'when';

/** Set up and rules, version 3. */
export default function SetupV3() {
  const setup = useSetup();
  const { world, draft, patch, errors, clear } = setup;
  const still = useReducedMotion();
  const [open, setOpen] = useState<Key | null>(null);

  const ready = (key: Key) => key === 'when' || partReady(draft, key);
  const toggle = (key: Key) => setOpen(open === key ? null : key);
  const done = (key: Key) => {
    if (key !== 'when' && !setup.check(key)) return;
    setOpen(null);
  };
  /** Once an item has opened, brings it into view if it sits off screen or low on it. */
  const reveal = (key: Key) => {
    const item = document.getElementById(`setup-item-${key}`);
    // The closing panel finishes too; only the one that is open now counts.
    if (!item?.querySelector('[aria-expanded="true"]')) return;
    const top = item?.getBoundingClientRect().top ?? 0;
    if (item && (top < 0 || top > window.innerHeight * 0.6))
      item.scrollIntoView({
        behavior: still ? 'auto' : 'smooth',
        block: 'start',
      });
  };

  const items: { key: Key; title: string; value: string; body: ReactNode }[] = [
    {
      key: 'details',
      title: 'Name and dates',
      value: detailsLine(draft),
      body: (
        <>
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
        </>
      ),
    },
    {
      key: 'rules',
      title: 'Rules',
      value: rulesLine(draft.rules),
      body: (
        <>
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
        </>
      ),
    },
    {
      key: 'stakes',
      title: 'What a miss costs',
      value: stakesLine(draft),
      body: (
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
      ),
    },
    {
      key: 'when',
      title: 'Deadline and time zone',
      value: deadlineZoneLine(draft),
      body: (
        <>
          <Labeled
            label="Log each day by 11:59 pm"
            hint={deadlineLine(draft.deadline)}
          >
            <SegmentedControl
              label="Log each day by 11:59 pm"
              value={deadlineId(draft.deadline)}
              onChange={(id) => {
                const chosen = DEADLINES.find((d) => d.id === id);
                if (chosen) patch({ deadline: chosen.deadline });
              }}
              options={DEADLINES.map((d) => ({
                value: d.id,
                label: d.label,
              }))}
            />
          </Labeled>
          <div className="flex items-center gap-3 border-t border-nx-line pt-5">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="nx-field-label">Time zone</p>
              <p className="flex flex-wrap items-center gap-x-2 text-nx-body">
                {zoneCity(draft.timeZone)}
                <span className="text-nx-2 text-nx-ink-2">
                  {zoneRegion(draft.timeZone)}
                </span>
              </p>
            </div>
            <Button
              variant="quiet"
              aria-label="Change time zone"
              onClick={() => setup.setOpen('zone')}
            >
              Change
            </Button>
          </div>
        </>
      ),
    },
  ];

  return (
    <PlainFrame back={{ to: 'start' }}>
      <div className="flex flex-col gap-8">
        <PageTitle title={`Set up ${draft.name.trim() || 'your challenge'}`} />
        <Stagger className="flex flex-col gap-3">
          {items.map((item) => (
            <ChecklistItem
              key={item.key}
              id={`setup-item-${item.key}`}
              title={item.title}
              value={item.value}
              ready={ready(item.key)}
              open={open === item.key}
              still={!!still}
              onToggle={() => toggle(item.key)}
              onOpened={() => reveal(item.key)}
              onDone={() => done(item.key)}
            >
              {item.body}
            </ChecklistItem>
          ))}
        </Stagger>
      </div>

      <ActionBar>
        <Button
          variant="primary"
          size="lg"
          full
          iconEnd={ArrowRight}
          loading={setup.busy}
          onClick={() => setup.finish(setOpen)}
        >
          {setup.finishLabel}
        </Button>
      </ActionBar>

      <SetupSheets setup={setup} />
    </PlainFrame>
  );
}

/** One thing to settle: a big row with its value and a tick, opening in place to change it. */
function ChecklistItem({
  id,
  title,
  value,
  ready,
  open,
  still,
  onToggle,
  onOpened,
  onDone,
  children,
}: {
  id: string;
  title: string;
  value: string;
  ready: boolean;
  open: boolean;
  still: boolean;
  onToggle: () => void;
  onOpened: () => void;
  onDone: () => void;
  children: ReactNode;
}) {
  const panel = useId();
  const Tick = ready ? CircleCheck : CircleDashed;
  return (
    <GlassCard pad="none" as="section" id={id} className="scroll-mt-24">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panel}
          onClick={onToggle}
          className="nx-press flex min-h-[76px] w-full items-center gap-4 rounded-nx px-5 py-4 text-left font-nx-sans"
        >
          <span
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-full transition-colors duration-200',
              ready
                ? 'bg-nx-done-soft text-nx-done'
                : 'bg-nx-sunken text-nx-ink-2',
            )}
          >
            <Tick size={24} aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-nx-lead font-semibold text-nx-ink">
              {title}
            </span>
            <span className="text-nx-2 text-nx-ink-2">{value}</span>
            <span className="sr-only">
              {ready ? 'Ready' : 'Needs attention'}
            </span>
          </span>
          <ChevronDown
            size={22}
            aria-hidden="true"
            className={cn(
              'shrink-0 text-nx-accent transition-transform duration-200 motion-reduce:transition-none',
              open && 'rotate-180',
            )}
          />
        </button>
      </h2>
      <Presence initial={false}>
        {open && (
          <motion.div
            key="panel"
            id={panel}
            className="overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: still ? 0 : DURATION.base, ease: EASE }}
            onAnimationComplete={onOpened}
          >
            <div className="flex flex-col gap-6 border-t border-nx-line px-5 py-5">
              {children}
              <Button className="w-full sm:w-auto sm:self-end" onClick={onDone}>
                Done
              </Button>
            </div>
          </motion.div>
        )}
      </Presence>
    </GlassCard>
  );
}
