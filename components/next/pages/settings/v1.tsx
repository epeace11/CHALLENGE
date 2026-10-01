// A calm list of grouped rows that show each setting's value; tapping one opens a sheet to change just that.
'use client';
import { useState } from 'react';
import { Clock3, Download, LogOut, Trash2 } from 'lucide-react';
import { AppFrame } from '@/components/next/frames';
import { useDemo, useWorld } from '@/components/next/world';
import {
  Avatar,
  Button,
  GlassCard,
  PageTitle,
  RowButton,
  Section,
  SegmentedControl,
  Sheet,
  TextField,
  Toggle,
  useToast,
} from '@/components/next/ui';
import { formatMoney } from '@/lib/next/selectors';
import {
  DEFAULT_REMINDERS,
  TIMES,
  capLine,
  changesOf,
  remindersLine,
  renamePerson,
  stepLine,
  termsError,
  termsOf,
  type Reminders,
  type Terms,
} from './data';
import {
  DeleteSheet,
  LeaveSheet,
  ProposalCard,
  TermsFields,
  TimeSelect,
} from './parts';
import { THEME_OPTIONS, useAccount, useThemeChoice } from './hooks';
import styles from './settings.module.css';

type Open = 'name' | 'times' | 'terms' | 'leave' | 'delete' | null;

/** Settings, version 1. */
export default function SettingsV1() {
  const world = useWorld();
  const { update, undo } = useDemo();
  const toast = useToast();
  const account = useAccount(world);
  const [theme, setTheme] = useThemeChoice();
  const [open, setOpen] = useState<Open>(null);
  const [reminders, setReminders] = useState<Reminders>(DEFAULT_REMINDERS);
  const [proposal, setProposal] = useState<Terms | null>(null);
  const c = world.challenge;
  const partner = world.partner.name;
  const now = termsOf(c);
  const close = (next: boolean) => {
    if (!next) setOpen(null);
  };

  return (
    <AppFrame>
      <div className="flex flex-col gap-9 pb-6">
        <PageTitle title="Settings" />

        <Section title="You" index={1}>
          <RowButton
            leading={<Avatar person={world.me} decorative />}
            title="Your name"
            detail={world.me.name}
            onClick={() => setOpen('name')}
          />
        </Section>

        <Section title="Reminders" index={2}>
          <GlassCard pad="sm" className="flex flex-col gap-1 px-5 sm:px-6">
            <Toggle
              checked={reminders.on}
              onChange={(on) => {
                setReminders({ ...reminders, on });
                toast(on ? 'Reminders on' : 'Reminders off');
              }}
              label="Evening reminders"
              description="Only when something is left to log"
            />
            <div className="-mx-2 border-t border-nx-line pt-2 sm:-mx-3">
              <RowButton
                glass={false}
                className="border-0 bg-transparent disabled:opacity-50"
                leading={
                  <Clock3
                    size={22}
                    className="text-nx-accent"
                    aria-hidden="true"
                  />
                }
                title="Times"
                detail={remindersLine(reminders)}
                disabled={!reminders.on}
                onClick={() => setOpen('times')}
              />
            </div>
          </GlassCard>
        </Section>

        <Section title="Appearance" index={3}>
          <SegmentedControl
            label="Appearance"
            value={theme}
            onChange={setTheme}
            options={THEME_OPTIONS}
            className={styles.seg}
          />
        </Section>

        <Section title={c.name} index={4}>
          <div className="flex flex-col gap-2.5">
            <RowButton
              title="Challenge name"
              detail={c.name}
              onClick={() => setOpen('terms')}
            />
            <RowButton
              title={`Dollar step: ${formatMoney(c.step)}`}
              detail={stepLine(c.step)}
              onClick={() => setOpen('terms')}
            />
            <RowButton
              title="Gift cap"
              detail={capLine(c.cap)}
              onClick={() => setOpen('terms')}
            />
          </div>
          {proposal ? (
            <ProposalCard
              partner={partner}
              changes={changesOf(now, proposal)}
              onWithdraw={() => {
                setProposal(null);
                toast('Withdrawn');
              }}
            />
          ) : (
            <p className="text-nx-2 text-nx-ink-2">
              Changes here go to {partner} to accept.
            </p>
          )}
          <Button
            variant="quiet"
            icon={LogOut}
            className="-ml-3 self-start text-nx-danger"
            onClick={() => setOpen('leave')}
          >
            Leave challenge
          </Button>
        </Section>

        <Section title="Your account" index={5}>
          <div className="flex flex-col gap-2.5">
            <RowButton
              leading={
                <Download
                  size={22}
                  className="text-nx-accent"
                  aria-hidden="true"
                />
              }
              title="Export my data"
              detail="A file of your answers, points and notes"
              onClick={account.exportData}
            />
            <RowButton
              leading={
                <LogOut
                  size={22}
                  className="text-nx-accent"
                  aria-hidden="true"
                />
              }
              title="Sign out"
              detail={world.me.email}
              onClick={account.signOut}
            />
            <RowButton
              leading={
                <Trash2
                  size={22}
                  className="text-nx-danger"
                  aria-hidden="true"
                />
              }
              title={<span className="text-nx-danger">Delete account</span>}
              onClick={() => setOpen('delete')}
            />
          </div>
        </Section>
      </div>

      <NameSheet
        open={open === 'name'}
        onOpenChange={close}
        name={world.me.name}
        onSave={(name) => {
          update((w) => renamePerson(w, w.me.id, name));
          toast({
            text: 'Name saved',
            action: { label: 'Undo', onClick: undo },
          });
        }}
      />
      <TimesSheet
        open={open === 'times'}
        onOpenChange={close}
        reminders={reminders}
        onSave={(r) => {
          setReminders(r);
          toast(`Reminders at ${remindersLine(r)}`);
        }}
      />
      <TermsSheet
        open={open === 'terms'}
        onOpenChange={close}
        now={now}
        start={proposal ?? now}
        onPropose={(t) => {
          setProposal(t);
          toast(`Sent to ${partner}`);
        }}
      />
      <LeaveSheet
        world={world}
        open={open === 'leave'}
        onOpenChange={close}
        onLeave={account.leave}
      />
      <DeleteSheet
        world={world}
        open={open === 'delete'}
        onOpenChange={close}
        onDelete={account.deleteAccount}
      />
    </AppFrame>
  );
}

/** Resets a sheet's draft each time the sheet opens. */
function useDraft<T>(open: boolean, initial: T) {
  const [draft, setDraft] = useState(initial);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(initial);
  }
  return [draft, setDraft] as const;
}

function NameSheet({
  open,
  onOpenChange,
  name,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  onSave: (name: string) => void;
}) {
  const [draft, setDraft] = useDraft(open, name);
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    if (!draft.trim()) return setError('Enter your name.');
    onSave(draft.trim());
    onOpenChange(false);
  };
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Your name"
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            disabled={draft.trim() === name}
            onClick={save}
          >
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
          value={draft}
          onChange={(v) => {
            setDraft(v);
            setError(null);
          }}
          autoComplete="given-name"
          maxLength={30}
          hint="Your partner sees it on every answer."
          error={error ?? undefined}
        />
      </form>
    </Sheet>
  );
}

function TimesSheet({
  open,
  onOpenChange,
  reminders,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reminders: Reminders;
  onSave: (r: Reminders) => void;
}) {
  const [draft, setDraft] = useDraft(open, reminders);
  const changed =
    draft.first !== reminders.first || draft.second !== reminders.second;
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Reminder times"
      description="Each evening, only if something is still left to log."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!changed}
            onClick={() => {
              onSave(draft);
              onOpenChange(false);
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TimeSelect
          label="First reminder"
          value={draft.first}
          options={TIMES.filter((t) => t < draft.second)}
          onChange={(first) => setDraft({ ...draft, first })}
        />
        <TimeSelect
          label="Second reminder"
          value={draft.second}
          options={TIMES.filter((t) => t > draft.first)}
          onChange={(second) => setDraft({ ...draft, second })}
        />
      </div>
    </Sheet>
  );
}

function TermsSheet({
  open,
  onOpenChange,
  now,
  start,
  onPropose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The challenge's terms today. */
  now: Terms;
  /** Where the form starts: today's terms, or the change still waiting. */
  start: Terms;
  onPropose: (t: Terms) => void;
}) {
  const world = useWorld();
  const [draft, setDraft] = useDraft(open, start);
  const [tried, setTried] = useDraft(open, false);
  const error = tried ? termsError(draft) : null;
  const changes = changesOf(now, draft);
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Propose a change"
      description={`${world.partner.name} accepts it before anything changes.${start === now ? '' : ' This replaces the change still waiting.'}`}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            disabled={changes.length === 0}
            onClick={() => {
              setTried(true);
              if (termsError(draft)) return;
              onPropose({ ...draft, name: draft.name.trim() });
              onOpenChange(false);
            }}
          >
            Propose to {world.partner.name}
          </Button>
        </>
      }
    >
      <TermsFields
        world={world}
        terms={draft}
        onChange={setDraft}
        error={error}
      />
    </Sheet>
  );
}
