'use client';
import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { PlainFrame } from '@/components/next/frames';
import { PasswordField } from '@/components/next/pages/signup/fields';
import { MIN_PASSWORD } from '@/components/next/pages/signup/form';
import { Button, GlassCard, PageTitle, useToast } from '@/components/next/ui';
import * as api from '@/lib/live/api';

/**
 * After the link in a password reset email (/app?reset=1), which signs in: choose the new password.
 * "Not now" keeps the old one.
 */
export function NewPassword({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const error = !password
    ? 'Choose a new password.'
    : password.length < MIN_PASSWORD
      ? `Use at least ${MIN_PASSWORD} characters.`
      : undefined;
  const save = async () => {
    setTried(true);
    if (error || busy) return;
    setBusy(true);
    try {
      await api.setPassword(password);
      onDone();
    } catch (e) {
      toast(
        e instanceof Error ? e.message : 'Something went wrong. Try again.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <PlainFrame center>
      <form
        noValidate
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <span className="nx-empty-icon mb-0" aria-hidden="true">
          <KeyRound size={28} />
        </span>
        <PageTitle
          title="Choose a new password"
          detail="You’re signed in. Use it next time you sign in."
        />
        <GlassCard className="flex flex-col gap-5">
          <PasswordField
            label="New password"
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
            hint={`At least ${MIN_PASSWORD} characters.`}
            error={tried ? error : undefined}
          />
          <Button type="submit" variant="primary" size="lg" full loading={busy}>
            Save password
          </Button>
        </GlassCard>
        <Button variant="quiet" className="-ml-3 self-start" onClick={onDone}>
          Not now
        </Button>
      </form>
    </PlainFrame>
  );
}
