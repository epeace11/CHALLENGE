'use client';
import { useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  CircleHelp,
  Dumbbell,
  Inbox,
  Plus,
  Send,
  Trash2,
} from 'lucide-react';
import { approve } from '@/lib/next/actions';
import { stepsShot } from '@/lib/next/shots';
import {
  formatDay,
  formatDuration,
  formatMoney,
  gets,
  openCheckins,
  openDay,
  reviewQueue,
  ruleById,
  timeLeft,
  weekProgress,
} from '@/lib/next/selectors';
import type { Proof } from '@/lib/next/model';
import { useNav } from './nav';
import { useDemo, useWorld } from './world';
import {
  ActionBar,
  Avatar,
  Button,
  Card,
  CountUp,
  EmptyState,
  Glide,
  GlassCard,
  IconButton,
  Item,
  Menu,
  NumberField,
  PageTitle,
  PairAvatars,
  PersonChip,
  Presence,
  ProgressBar,
  ProofStrip,
  RowButton,
  Section,
  SegmentedControl,
  Sheet,
  StackedBar,
  StatButton,
  StatusPill,
  TapCard,
  TextField,
  Toggle,
  YesNo,
  useToast,
} from './ui';

/**
 * Every kit component on sample data, at /preview?kit. A reference for building pages and a quick
 * check of the kit in each theme and look; not a page of the product.
 */
export function KitGallery() {
  const world = useWorld();
  const { update, undo } = useDemo();
  const { navigate } = useNav();
  const toast = useToast();
  const me = world.me.id;
  const [sheet, setSheet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [answer, setAnswer] = useState<boolean | null>(null);
  const [steps, setSteps] = useState<number | null>(11240);
  const [minutes, setMinutes] = useState<number | null>(72);
  const [note, setNote] = useState('');
  const [reminders, setReminders] = useState(true);
  const [range, setRange] = useState<'week' | 'month'>('week');
  const [who, setWho] = useState<'maya' | 'jordan'>('maya');
  const [count, setCount] = useState(45);
  const [card, setCard] = useState(0);
  const [items, setItems] = useState([
    'Gym, Nov 16',
    'Gym, Nov 17',
    'Gym, Nov 19',
  ]);
  const [proofs, setProofs] = useState<Proof[]>(
    reviewQueue(world, me).answers[0]?.entry.proofs ?? [],
  );
  const day = openDay(world);
  const queue = reviewQueue(world, me);
  const gym = weekProgress(world, me, 'gym');

  return (
    <main className="nx-main flex flex-col gap-10 pt-8 pb-16">
      <PageTitle
        kicker="Kit"
        title="Every component"
        detail="On sample data. Switch light, dark and the look to check each."
        action={
          <IconButton
            icon={ChevronLeft}
            label="All pages"
            onClick={() => navigate(null)}
          />
        }
      />

      <Section id="buttons" title="Buttons" index={1}>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" iconEnd={ArrowRight}>
            Save
          </Button>
          <Button icon={Send}>Invite Jordan</Button>
          <Button variant="quiet">How it works</Button>
          <Button variant="danger" icon={Trash2}>
            Delete challenge
          </Button>
          <Button
            variant="primary"
            loading={saving}
            onClick={() => {
              setSaving(true);
              setTimeout(() => setSaving(false), 1200);
            }}
          >
            Approve
          </Button>
          <Button disabled>Sign</Button>
          <IconButton icon={CircleHelp} label="How it works" />
        </div>
        <Button variant="primary" size="lg" full>
          Save and go to the next
        </Button>
      </Section>

      <Section id="numbers" title="Numbers that lead somewhere" index={2}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatButton
            label="Left to log"
            value={openCheckins(world, me).length}
            hint={day ? formatDay(day) : undefined}
            tone="accent"
            onClick={() => navigate('log')}
          />
          <StatButton
            label="Waiting for you"
            value={queue.count}
            hint="Answers and requests"
            tone="wait"
            onClick={() => navigate('review')}
          />
          <StatButton
            label="Your gift"
            value={gets(world, me)}
            format={formatMoney}
            hint="From Jordan’s 9 points"
            onClick={() => navigate('gifts')}
          />
          <StatButton
            label="Gym this week"
            value={gym ? `${gym.have} of ${gym.need}` : '–'}
            hint={gym ? `${gym.daysLeft} days left` : undefined}
            onClick={() => navigate('progress')}
          />
        </div>
        <StatButton
          size="lg"
          label="Time left to log Thursday"
          value={formatDuration(timeLeft(world))}
          hint="Until 11:59 pm tonight"
          onClick={() => navigate('log')}
        />
      </Section>

      <Section id="cards" title="Cards and rows" index={3}>
        <div className="grid gap-3 md:grid-cols-2">
          <GlassCard>
            <h3 className="font-nx-serif text-nx-h3">GlassCard</h3>
            <p className="mt-1 text-nx-2 text-nx-ink-2">
              The main surface. Frosted, soft shadow.
            </p>
          </GlassCard>
          <Card>
            <h3 className="font-nx-serif text-nx-h3">Card</h3>
            <p className="mt-1 text-nx-2 text-nx-ink-2">
              A quieter surface for groups inside a glass card.
            </p>
          </Card>
        </div>
        <TapCard onClick={() => navigate('recap')}>
          <span className="block text-nx-body font-semibold">
            TapCard: the whole card is one button
          </span>
          <span className="block text-nx-2 text-nx-ink-2">
            Opens the Monday recap.
          </span>
        </TapCard>
        <RowButton
          leading={<Avatar person={world.partner} decorative />}
          title="Jordan’s 10,000 steps"
          detail="Thursday · 11,240 steps"
          trailing={<StatusPill status="review" />}
          onClick={() => navigate('review')}
        />
      </Section>

      <Section id="progress" title="Progress" index={4}>
        <GlassCard className="flex flex-col gap-4">
          <ProgressBar value={19} max={30} label="Day 19 of 30" />
          <ProgressBar
            value={gym?.have ?? 0}
            max={gym?.need ?? 4}
            segments
            tone="done"
            label="Gym this week"
          />
          <ProgressBar
            value={2}
            max={5}
            size="sm"
            tone="wait"
            label="Waiting"
          />
          <StackedBar
            label="Maya: 96 done, 4 forgiven, 6 missed, 2 waiting"
            parts={[
              { tone: 'done', value: 96 },
              { tone: 'excused', value: 4 },
              { tone: 'missed', value: 6 },
              { tone: 'wait', value: 2 },
              { tone: 'ahead', value: 70 },
            ]}
          />
        </GlassCard>
      </Section>

      <Section id="people" title="People and status" index={5}>
        <div className="flex flex-wrap items-center gap-3">
          <Avatar person={world.me} size="sm" />
          <Avatar person={world.me} />
          <Avatar person={world.partner} size="lg" />
          <PairAvatars people={world.couple.people} size="lg" />
          <PersonChip person={world.me}>You</PersonChip>
          <PersonChip
            person={world.partner}
            pressed={who === 'jordan'}
            onClick={() => setWho(who === 'jordan' ? 'maya' : 'jordan')}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill status="done" />
          <StatusPill status="missed" />
          <StatusPill status="review" />
          <StatusPill status="forgiven" />
          <StatusPill status="disputed" />
          <StatusPill status="open" />
          <StatusPill status="none" label="No" />
        </div>
      </Section>

      <Section id="fields" title="Answers and fields" index={6}>
        <GlassCard className="flex flex-col gap-6">
          <YesNo
            label="Did you skip eating out?"
            value={answer}
            onChange={setAnswer}
          />
          <NumberField
            label="Steps on Thursday"
            value={steps}
            onChange={setSteps}
            target={ruleById(world.challenge, 'steps')?.target}
            step={500}
          />
          <NumberField
            label="Social media and games"
            value={minutes}
            onChange={setMinutes}
            target={ruleById(world.challenge, 'social')?.target}
          />
          <TextField
            label="Note"
            multiline
            value={note}
            onChange={setNote}
            placeholder="Anything Jordan should know"
            hint="Jordan sees it with your answer."
          />
          <TextField
            label="Jordan’s email"
            type="email"
            value="jordan@"
            onChange={() => {}}
            error="Enter a full email address."
          />
          <Toggle
            checked={reminders}
            onChange={setReminders}
            label="Evening reminder"
            description="At 8 pm when something is left to log"
          />
          <SegmentedControl
            label="Show"
            value={range}
            onChange={setRange}
            options={[
              { value: 'week', label: 'This week' },
              { value: 'month', label: 'Whole challenge' },
            ]}
          />
          <ProofStrip
            proofs={proofs}
            onRemove={(id) => setProofs(proofs.filter((p) => p.id !== id))}
            onAdd={() =>
              setProofs([
                ...proofs,
                {
                  id: `added-${proofs.length}`,
                  src: stepsShot(10000 + proofs.length * 850, '2026-11-19'),
                  alt: 'Step count screenshot',
                },
              ])
            }
          />
        </GlassCard>
      </Section>

      <Section id="overlays" title="Sheet, toast and menu" index={7}>
        <div className="flex flex-wrap gap-3">
          <Button icon={CircleHelp} onClick={() => setSheet(true)}>
            How it works
          </Button>
          <Button
            icon={Check}
            onClick={() => {
              const answer = queue.answers[0];
              if (answer) update((w) => approve(w, answer.entry.id));
              toast({
                text: answer ? 'Approved Jordan’s steps' : 'Nothing to approve',
                action: answer ? { label: 'Undo', onClick: undo } : undefined,
              });
            }}
          >
            Approve with a toast
          </Button>
          <Menu
            trigger={<Button icon={Plus}>Menu</Button>}
            align="start"
            items={[
              { label: 'Gifts', onSelect: () => navigate('gifts') },
              { label: 'Rules and help', onSelect: () => navigate('rules') },
            ]}
          />
        </div>
        <Sheet
          open={sheet}
          onOpenChange={setSheet}
          title="How points work"
          description="Each miss is a point. The first costs $1, the second $2, and so on."
          footer={
            <>
              <Button onClick={() => setSheet(false)}>Close</Button>
              <Button variant="primary" onClick={() => navigate('gifts')}>
                See the gifts
              </Button>
            </>
          }
        >
          <p className="text-nx-body">
            Jordan has 9 points, so your gift is at $45. His next miss adds $10.
          </p>
        </Sheet>
      </Section>

      <Section id="motion" title="Motion" index={8}>
        <GlassCard className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <span className="font-nx-serif text-nx-num-lg">
              <CountUp value={count} format={formatMoney} />
            </span>
            <Button onClick={() => setCount(count + 10)}>Add $10</Button>
          </div>
          <Glide id={card}>
            <Card className="flex items-center gap-3">
              <Dumbbell className="text-nx-accent" aria-hidden="true" />
              <span className="text-nx-body">Check-in {card + 1} of 3</span>
            </Card>
          </Glide>
          <Button onClick={() => setCard((card + 1) % 3)} iconEnd={ArrowRight}>
            Next check-in
          </Button>
          <div className="relative flex flex-col gap-2">
            <Presence mode="popLayout" initial={false}>
              {items.map((label) => (
                <Item key={label}>
                  <RowButton
                    glass={false}
                    title={label}
                    detail="Tap to remove"
                    onClick={() => setItems(items.filter((x) => x !== label))}
                  />
                </Item>
              ))}
            </Presence>
          </div>
        </GlassCard>
      </Section>

      <Section id="empty" title="Empty state" index={9}>
        <GlassCard>
          <EmptyState
            icon={Inbox}
            title="Nothing to review"
            action={
              <Button onClick={() => navigate('overview')}>
                Back to Overview
              </Button>
            }
          >
            Jordan’s next answers show up here.
          </EmptyState>
        </GlassCard>
      </Section>

      <ActionBar>
        <Button variant="primary" full>
          Save
        </Button>
        <Button variant="quiet">Skip for now</Button>
      </ActionBar>
    </main>
  );
}
