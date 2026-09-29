'use client';
import { useId, useRef, useState, type ReactNode } from 'react';
import {
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Gift,
  Inbox,
  CircleCheckBig,
  type LucideIcon,
} from 'lucide-react';
import type { Rule } from '@/lib/next/model';
import {
  activePoints,
  formatDayShort,
  formatDeadline,
  formatMoney,
  owes,
} from '@/lib/next/selectors';
import { useNav } from '@/components/next/nav';
import {
  Button,
  Card,
  GlassCard,
  Item,
  PairAvatars,
  Avatar,
  Presence,
  RowButton,
  Sheet,
  StatusPill,
  useToast,
} from '@/components/next/ui';
import { useWorld } from '@/components/next/world';
import { cn } from '@/lib/utils';
import {
  answerLabel,
  describe,
  whenLabel,
  whoLabel,
  type Proposal,
  type ProposalKind,
} from './facts';
import { ProposalSheet } from './proposal-sheet';
import styles from './rules.module.css';

/* ── Proposals: local until the partner approves (the preview has no partner to ask) ─────────── */

export function useProposals() {
  const world = useWorld();
  const toast = useToast();
  const [list, setList] = useState<Proposal[]>([]);
  const made = useRef(0);
  // The form: open or not, what it starts on, and a key so each opening starts fresh.
  const [form, setForm] = useState<{
    open: boolean;
    key: number;
    preset: { kind: ProposalKind; ruleId?: string };
  }>({ open: false, key: 0, preset: { kind: 'add' } });

  const propose = (kind: ProposalKind = 'add', ruleId?: string) =>
    setForm((f) => ({ open: true, key: f.key + 1, preset: { kind, ruleId } }));
  const send = (p: Omit<Proposal, 'id' | 'sentAt'>) => {
    made.current += 1;
    const proposal: Proposal = {
      ...p,
      id: `proposal-${made.current}`,
      sentAt: world.now,
    };
    setList((l) => [...l, proposal]);
    setForm((f) => ({ ...f, open: false }));
    toast({
      text: `Sent to ${world.partner.name}`,
      action: {
        label: 'Undo',
        onClick: () => setList((l) => l.filter((x) => x.id !== proposal.id)),
      },
    });
  };
  const withdraw = (id: string) => {
    const gone = list.find((p) => p.id === id);
    setList((l) => l.filter((p) => p.id !== id));
    if (gone)
      toast({
        text: 'Proposal withdrawn',
        action: { label: 'Undo', onClick: () => setList((l) => [...l, gone]) },
      });
  };
  const sheet = (
    <ProposalSheet
      key={form.key}
      open={form.open}
      onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
      preset={form.preset}
      onSend={send}
    />
  );
  return {
    list,
    propose,
    withdraw,
    /** The proposal waiting on a rule, if any. */
    pendingFor: (ruleId: string) => list.find((p) => p.ruleId === ruleId),
    sheet,
  };
}

export type Proposals = ReturnType<typeof useProposals>;

/** Proposals sent and waiting for the partner, each with Withdraw. */
export function WaitingProposals({ proposals }: { proposals: Proposals }) {
  const world = useWorld();
  const partner = world.partner.name;
  // Always rendered, so the last one can leave smoothly; hidden while empty.
  return (
    <div className="relative flex flex-col gap-3 empty:hidden">
      <Presence mode="popLayout" initial={false}>
        {proposals.list.map((p) => {
          const { title, detail } = describe(world, p);
          return (
            <Item key={p.id}>
              <GlassCard className="flex flex-col gap-3">
                <span className="flex">
                  <StatusPill
                    status="review"
                    label={`Waiting for ${partner}`}
                  />
                </span>
                <div className="flex flex-col gap-1">
                  <p className="font-nx-serif text-nx-h3 text-nx-ink">
                    {title}
                  </p>
                  <p className="text-nx-2 text-nx-ink-2">{detail}</p>
                  {p.note && (
                    <p className="mt-1 text-nx-body text-nx-ink">“{p.note}”</p>
                  )}
                </div>
                <Button
                  variant="quiet"
                  className="-ml-3 self-start"
                  onClick={() => proposals.withdraw(p.id)}
                >
                  Withdraw
                </Button>
              </GlassCard>
            </Item>
          );
        })}
      </Presence>
    </div>
  );
}

/* ── One rule ──────────────────────────────────────────────────────────── */

/** The group's people: both avatars for shared rules, one for a person's own. The title says the names. */
export function GroupMark({
  people,
}: {
  people: { name: string; initial: string; hue: number }[];
}) {
  return (
    <span aria-hidden="true" className="inline-flex">
      {people.length > 1 ? (
        <PairAvatars people={people} size="sm" />
      ) : (
        <Avatar person={people[0]} size="sm" decorative />
      )}
    </span>
  );
}

/** Everything about one rule, and proposing to change or retire it. */
export function RuleSheet({
  rule,
  onClose,
  proposals,
}: {
  rule: Rule | null;
  onClose: () => void;
  proposals: Proposals;
}) {
  const world = useWorld();
  // Keep the rule on screen while the sheet slides away.
  const [shown, setShown] = useState<Rule | null>(rule);
  if (rule && rule.id !== shown?.id) setShown(rule);
  const pending = shown ? proposals.pendingFor(shown.id) : undefined;
  const c = world.challenge;
  const facts: [string, string][] = shown
    ? [
        ['For', whoLabel(world, shown.who)],
        ['Days', whenLabel(shown)],
        ['Answer', answerLabel(shown)],
        [
          'Screenshot',
          shown.proof === 'required'
            ? 'Required'
            : shown.proof === 'optional'
              ? 'Optional'
              : 'Not needed',
        ],
        ...(shown.startsOn && shown.startsOn > c.start
          ? [['Since', formatDayShort(shown.startsOn)] as [string, string]]
          : []),
        ...(shown.endsOn
          ? [['Until', formatDayShort(shown.endsOn)] as [string, string]]
          : []),
      ]
    : [];
  const go = (kind: ProposalKind) => {
    if (!shown) return;
    onClose();
    proposals.propose(kind, shown.id);
  };
  return (
    <Sheet
      open={!!rule}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={shown?.title ?? 'Rule'}
      footer={
        shown && !pending ? (
          <>
            <Button onClick={() => go('retire')}>Propose retiring it</Button>
            <Button variant="primary" onClick={() => go('change')}>
              Propose a change
            </Button>
          </>
        ) : undefined
      }
    >
      {shown && (
        <div className="flex flex-col gap-6">
          {pending && (
            <Card pad="sm" className="flex flex-col items-start gap-2">
              <StatusPill
                status="review"
                label={`Waiting for ${world.partner.name}`}
              />
              <p className="text-nx-body text-nx-ink">
                {describe(world, pending).detail}
              </p>
            </Card>
          )}
          <div className="flex flex-col gap-2">
            <p className="text-nx-2 font-semibold text-nx-ink-2">
              The question
            </p>
            <p className="font-nx-serif text-nx-h3 text-nx-ink">
              “{shown.question}”
            </p>
            <p className="text-nx-body text-nx-ink-2">{shown.description}</p>
          </div>
          <dl className="flex flex-col">
            {facts.map(([term, value]) => (
              <div
                key={term}
                className="flex items-baseline justify-between gap-4 border-t border-nx-line py-3"
              >
                <dt className="text-nx-2 text-nx-ink-2">{term}</dt>
                <dd className="text-right text-nx-body font-semibold text-nx-ink">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </Sheet>
  );
}

/* ── Deadline and stakes ───────────────────────────────────────────────── */

/** The deadline and what each point costs; each opens where it is set or where it adds up. */
export function StakesRows({ glass = true }: { glass?: boolean }) {
  const world = useWorld();
  const { navigate } = useNav();
  const c = world.challenge;
  const lead = (Icon: LucideIcon) => (
    <span className={styles.groupIcon}>
      <Icon size={20} aria-hidden="true" />
    </span>
  );
  return (
    <div className="flex flex-col gap-2">
      <RowButton
        glass={glass}
        leading={lead(CalendarClock)}
        title="Deadline"
        detail={`Each day by ${formatDeadline(c.deadline)}`}
        onClick={() => navigate('settings')}
      />
      <RowButton
        glass={glass}
        leading={lead(Gift)}
        title="Each point"
        detail={`${formatMoney(c.step)} more than the one before${c.cap !== null ? `, up to ${formatMoney(c.cap)} a gift` : ''}`}
        onClick={() => navigate('gifts')}
      />
    </div>
  );
}

/* ── How it works: short answers that open in place ────────────────────── */

type Answer = { id: string; q: string; a: ReactNode; more?: ReactNode };

function AnswerLink({
  icon: Icon,
  children,
  onClick,
}: {
  icon: LucideIcon;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="nx-press -ml-3 inline-flex min-h-11 items-center gap-2 rounded-nx-sm px-3 text-left text-nx-2 text-nx-accent hover:bg-nx-accent-soft"
    >
      <Icon size={18} aria-hidden="true" className="shrink-0" />
      <span className="font-semibold">{children}</span>
      <ChevronRight size={18} aria-hidden="true" className="shrink-0" />
    </button>
  );
}

export function HowItWorks({ className }: { className?: string }) {
  const world = useWorld();
  const { navigate } = useNav();
  const [open, setOpen] = useState<string | null>(null);
  const base = useId();
  const c = world.challenge,
    partner = world.partner.name,
    mine = activePoints(world, world.me.id).length;
  const terms = Array.from({ length: mine }, (_, i) =>
    formatMoney((i + 1) * c.step),
  );
  const sum =
    terms.length > 6
      ? `${terms.slice(0, 3).join(' + ')} + … + ${terms[terms.length - 1]}`
      : terms.join(' + ');
  const items: Answer[] = [
    {
      id: 'deadline',
      q: 'When do we answer?',
      a: 'Every day, for the day before, by the deadline. A check-in still empty then is a point. A change after the deadline counts once the other approves it.',
      more: (
        <AnswerLink icon={CircleCheckBig} onClick={() => navigate('log')}>
          Check in
        </AnswerLink>
      ),
    },
    {
      id: 'review',
      q: 'How does reviewing work?',
      a: 'You review each other’s Yes answers: approve one, or dispute it and say why. The owner accepts a dispute, which makes it a point, or it is withdrawn.',
      more: (
        <AnswerLink icon={Inbox} onClick={() => navigate('review')}>
          Go to Review
        </AnswerLink>
      ),
    },
    {
      id: 'points',
      q: 'What counts as a point?',
      a: 'A No, a number off target, or a check-in left empty. A weekly rule adds a point for each visit short when its week ends.',
    },
    {
      id: 'forgive',
      q: 'How does forgiveness work?',
      a: `With a No you can ask ${partner} to forgive it and say why. If ${partner} agrees, the point costs nothing. Either of you can also forgive a point without being asked.`,
    },
    {
      id: 'cost',
      q: 'What does a point cost?',
      a: 'Each point costs more than the one before, so misses add up faster as they pile up.',
      more:
        mine > 0 ? (
          <AnswerLink icon={Gift} onClick={() => navigate('gifts')}>
            Your {mine} points: {c.cap === null ? `${sum} = ` : ''}
            {formatMoney(owes(world, world.me.id))}
          </AnswerLink>
        ) : undefined,
    },
    {
      id: 'gift',
      q: 'How does the gift work?',
      a: 'When the challenge ends, each of you buys the other a gift worth your own points. Fewer points wins.',
      more: (
        <AnswerLink icon={Gift} onClick={() => navigate('gifts')}>
          See the gifts
        </AnswerLink>
      ),
    },
    {
      id: 'changes',
      q: 'How do rule changes work?',
      a: 'Either of you proposes adding, changing or retiring a rule, and the day it starts. It counts from that day once the other approves.',
    },
  ];
  return (
    <div className={cn(styles.faq, className)}>
      {items.map((item) => {
        const isOpen = open === item.id,
          panel = `${base}-${item.id}`;
        return (
          <div key={item.id} className={styles.faqItem}>
            <h3 className="font-nx-sans">
              <button
                type="button"
                className={cn(styles.faqButton, 'nx-press')}
                aria-expanded={isOpen}
                aria-controls={panel}
                onClick={() => setOpen(isOpen ? null : item.id)}
              >
                <span className="font-semibold">{item.q}</span>
                <ChevronDown
                  size={20}
                  aria-hidden="true"
                  className={styles.faqChevron}
                />
              </button>
            </h3>
            <div
              id={panel}
              className={styles.faqAnswer}
              data-open={isOpen || undefined}
              inert={!isOpen}
            >
              <div>
                <div className={styles.faqBody}>
                  <p className="text-nx-body text-nx-ink-2">{item.a}</p>
                  {item.more}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
