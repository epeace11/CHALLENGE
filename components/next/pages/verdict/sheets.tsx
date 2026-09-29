'use client';
import { useState } from 'react';
import { Flame, RotateCcw, Sparkles } from 'lucide-react';
import { Avatar, Button, Card, Sheet, TextField } from '@/components/next/ui';
import { formatMoney, plural } from '@/lib/next/selectors';
import { BADGE_ICON, giftSum, type VerdictView } from './data';

export type VerdictSheet = 'gifts' | 'streaks' | 'badges' | 'save' | null;

/** "You", or the partner's name. */
const who = (s: VerdictView['me']) => (s.isMe ? 'You' : s.person.name);

/** How each gift adds up: the nth point costs n times the step, forgiven points cost nothing. */
export function GiftsSheet({
  v,
  open,
  onOpenChange,
}: {
  v: VerdictView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // The gift a person gets comes from the other person's points.
  const rows = [
    { gets: v.me, from: v.partner },
    { gets: v.partner, from: v.me },
  ];
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="How the gifts were set"
      description={`The first point cost ${formatMoney(v.step)}, the second ${formatMoney(2 * v.step)}, and so on. Fewer points wins.`}
    >
      <div className="flex flex-col gap-3">
        {rows.map(({ gets, from }) => (
          <Card key={gets.person.id} className="flex flex-col gap-2">
            <p className="flex items-center gap-3 text-nx-body font-semibold">
              <Avatar person={from.person} size="sm" decorative />
              {who(from)}: {plural(from.points, 'point')}
              {from.forgiven > 0 ? `, ${from.forgiven} forgiven` : ''}
            </p>
            <p className="text-nx-body tabular-nums">
              {giftSum(from.points, v.step, v.cap)}
            </p>
            <p className="text-nx-2 text-nx-ink-2">
              {gets.isMe
                ? `Your gift from ${from.person.name}: ${formatMoney(gets.gets)}.`
                : `${gets.person.name}’s gift from you: ${formatMoney(gets.gets)}.`}
              {from.forgiven > 0 ? ' Forgiven points cost nothing.' : ''}
            </p>
          </Card>
        ))}
      </div>
    </Sheet>
  );
}

/** Each person's longest run, and the way to run it again. */
export function StreaksSheet({
  v,
  open,
  onOpenChange,
  onRunAgain,
}: {
  v: VerdictView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRunAgain: () => void;
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Best streaks"
      footer={
        <Button variant="primary" icon={RotateCcw} onClick={onRunAgain}>
          Run it again
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        {[v.me, v.partner].map((s) => (
          <Card key={s.person.id} className="flex gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-nx-accent-soft text-nx-accent">
              <Flame size={20} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-nx-body font-semibold">
                {who(s)}: {s.streak.title}
              </p>
              <p className="text-nx-body">
                {s.streak.all
                  ? `All ${s.streak.days} days`
                  : `${s.streak.days} days in a row`}
              </p>
              {s.streak.description && (
                <p className="mt-1 text-nx-2 text-nx-ink-2">
                  {s.streak.description}
                </p>
              )}
            </div>
          </Card>
        ))}
      </div>
    </Sheet>
  );
}

/** Every badge each person earned, with how it was earned. */
export function BadgesSheet({
  v,
  open,
  onOpenChange,
}: {
  v: VerdictView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Badges earned">
      <div className="flex flex-col gap-6">
        {[v.me, v.partner].map((s) => (
          <section key={s.person.id} className="flex flex-col gap-2">
            <h3 className="font-nx-serif text-nx-h3">
              {s.isMe ? 'You' : s.person.name}
            </h3>
            <ul className="flex flex-col gap-2">
              {s.badges.map((b) => {
                const Icon = BADGE_ICON[b.id] ?? Sparkles;
                return (
                  <li
                    key={b.id}
                    className="flex min-h-14 items-center gap-3 rounded-nx border border-nx-line bg-nx-surface-2 px-4 py-2.5"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-nx-accent-soft text-nx-accent">
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="text-nx-body font-semibold">
                        {b.title}
                      </span>
                      {b.how && (
                        <span className="text-nx-2 text-nx-ink-2">{b.how}</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </Sheet>
  );
}

/** Save the finished challenge under a new name, to run again later. */
export function SaveSheet({
  open,
  onOpenChange,
  suggestion,
  taken,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestion: string;
  /** Names already used by saved challenges. */
  taken: string[];
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(suggestion);
  const [error, setError] = useState<string | null>(null);
  // A fresh name each time it opens.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(suggestion);
      setError(null);
    }
  }
  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return setError('Give it a name.');
    if (taken.some((t) => t.toLowerCase() === trimmed.toLowerCase()))
      return setError(`You already have one called ${trimmed}.`);
    onSave(trimmed);
    onOpenChange(false);
  };
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Save as"
      description="Same rules and stakes, ready to start again from Your challenges."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <TextField
          label="Name"
          value={name}
          onChange={(value) => {
            setName(value);
            setError(null);
          }}
          maxLength={40}
          autoComplete="off"
          error={error ?? undefined}
        />
      </form>
    </Sheet>
  );
}
