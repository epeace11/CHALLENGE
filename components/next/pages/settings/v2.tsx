// Version 2: every setting sits on one page as a plain control; switches apply at once, and typed changes wait for one Save bar that rises at the bottom.
'use client';
import { useState } from 'react';
import { Download, LogOut, Trash2 } from 'lucide-react';
import { AppFrame } from '@/components/next/frames';
import { useDemo, useWorld } from '@/components/next/world';
import {
  ActionBar,
  Button,
  GlassCard,
  PageTitle,
  Section,
  SegmentedControl,
  TextField,
  Toggle,
  useToast,
} from '@/components/next/ui';
import {
  DEFAULT_REMINDERS,
  TIMES,
  changesOf,
  remindersLine,
  renamePerson,
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

/** Settings, version 2. */
export default function SettingsV2() {
  const world = useWorld();
  const { update, undo } = useDemo();
  const toast = useToast();
  const account = useAccount(world);
  const [theme, setTheme] = useThemeChoice();
  const [reminders, setReminders] = useState<Reminders>(DEFAULT_REMINDERS);
  const [open, setOpen] = useState<'leave' | 'delete' | null>(null);
  const [proposal, setProposal] = useState<Terms | null>(null);
  const [tried, setTried] = useState(false);
  const partner = world.partner.name;
  const now = termsOf(world.challenge);
  const [terms, setTerms] = useState<Terms>(now);
  // The name field follows the saved name when it changes elsewhere (an Undo, for one).
  const [name, setName] = useState(world.me.name);
  const [savedName, setSavedName] = useState(world.me.name);
  if (world.me.name !== savedName) {
    setSavedName(world.me.name);
    setName(world.me.name);
  }

  const nameDirty = name.trim() !== world.me.name;
  const changes = changesOf(now, terms);
  const termsDirty = changes.length > 0;
  const nameError =
    tried && nameDirty && !name.trim() ? 'Enter your name.' : null;
  const error = tried && termsDirty ? termsError(terms) : null;
  const label =
    nameDirty && termsDirty
      ? `Save and propose to ${partner}`
      : termsDirty
        ? `Propose to ${partner}`
        : 'Save';

  const setReminder = (next: Reminders, words: string) => {
    setReminders(next);
    toast(words);
  };
  const save = () => {
    setTried(true);
    if ((nameDirty && !name.trim()) || (termsDirty && termsError(terms)))
      return;
    if (nameDirty) update((w) => renamePerson(w, w.me.id, name));
    if (termsDirty) {
      setProposal({ ...terms, name: terms.name.trim() });
      setTerms(now);
    }
    setTried(false);
    if (nameDirty && termsDirty) toast(`Name saved. Sent to ${partner}.`);
    else if (nameDirty)
      toast({ text: 'Name saved', action: { label: 'Undo', onClick: undo } });
    else toast(`Sent to ${partner}`);
  };
  const discard = () => {
    setName(world.me.name);
    setTerms(now);
    setTried(false);
  };

  return (
    <AppFrame>
      <div className="flex flex-col gap-9 pb-6">
        <PageTitle title="Settings" />

        <Section title="You" index={1}>
          <GlassCard>
            <TextField
              label="Your name"
              value={name}
              onChange={setName}
              autoComplete="given-name"
              maxLength={30}
              hint={`${partner} sees it on every answer.`}
              error={nameError ?? undefined}
            />
          </GlassCard>
        </Section>

        <Section title="Reminders" index={2}>
          <GlassCard className="flex flex-col gap-4">
            <Toggle
              checked={reminders.on}
              onChange={(on) =>
                setReminder(
                  { ...reminders, on },
                  on ? 'Reminders on' : 'Reminders off',
                )
              }
              label="Evening reminders"
              description="Only when something is left to log"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TimeSelect
                label="First reminder"
                value={reminders.first}
                options={TIMES.filter((t) => t < reminders.second)}
                disabled={!reminders.on}
                onChange={(first) => {
                  const next = { ...reminders, first };
                  setReminder(next, `Reminders at ${remindersLine(next)}`);
                }}
              />
              <TimeSelect
                label="Second reminder"
                value={reminders.second}
                options={TIMES.filter((t) => t > reminders.first)}
                disabled={!reminders.on}
                onChange={(second) => {
                  const next = { ...reminders, second };
                  setReminder(next, `Reminders at ${remindersLine(next)}`);
                }}
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

        <Section title={world.challenge.name} index={4}>
          <GlassCard className="flex flex-col gap-5">
            <p className="text-nx-2 text-nx-ink-2">
              Changes here go to {partner} to accept.
            </p>
            <TermsFields
              world={world}
              terms={terms}
              onChange={setTerms}
              error={error}
            />
          </GlassCard>
          {proposal && (
            <ProposalCard
              partner={partner}
              changes={changesOf(now, proposal)}
              onWithdraw={() => {
                setProposal(null);
                toast('Withdrawn');
              }}
            />
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
          <GlassCard className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Button icon={Download} onClick={account.exportData}>
                Export my data
              </Button>
              <Button icon={LogOut} onClick={account.signOut}>
                Sign out
              </Button>
            </div>
            <Button
              variant="quiet"
              icon={Trash2}
              className="self-start text-nx-danger"
              onClick={() => setOpen('delete')}
            >
              Delete account
            </Button>
          </GlassCard>
        </Section>
      </div>

      {(nameDirty || termsDirty) && (
        <ActionBar className={styles.rise}>
          <Button variant="primary" size="lg" full onClick={save}>
            {label}
          </Button>
          <Button variant="quiet" onClick={discard}>
            Discard changes
          </Button>
        </ActionBar>
      )}

      <LeaveSheet
        world={world}
        open={open === 'leave'}
        onOpenChange={(o) => {
          if (!o) setOpen(null);
        }}
        onLeave={account.leave}
      />
      <DeleteSheet
        world={world}
        open={open === 'delete'}
        onOpenChange={(o) => {
          if (!o) setOpen(null);
        }}
        onDelete={account.deleteAccount}
      />
    </AppFrame>
  );
}
