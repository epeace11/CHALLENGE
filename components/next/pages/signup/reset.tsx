'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, KeyRound, Mail, RotateCcw } from 'lucide-react';
import { useBackend } from '@/components/next/backend';
import {
  Button,
  GlassCard,
  Glide,
  TextField,
  useToast,
} from '@/components/next/ui';
import { CodeField, PasswordField } from './fields';
import { MIN_PASSWORD, codeError, validate } from './form';

/**
 * "Forgot your password?", from Sign in: first the email address, then the six-digit code from the
 * reset email and a new password, which signs in. The email's link works too (/app?reset=1).
 */
export function ResetPanel({
  email: startEmail,
  onBack,
  onDone,
}: {
  email: string;
  onBack: () => void;
  /** The preview's way on, once the new password is saved; the live app moves on by itself. */
  onDone: () => void;
}) {
  const { host } = useBackend();
  const toast = useToast();
  const [email, setEmail] = useState(startEmail);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => title.current?.focus({ preventScroll: true }), [sentTo]);

  const emailError = validate(
    { name: '', email, password: '' },
    'signin',
    'link',
  ).email;
  const passwordError = !password
    ? 'Choose a new password.'
    : password.length < MIN_PASSWORD
      ? `Use at least ${MIN_PASSWORD} characters.`
      : undefined;

  const send = async () => {
    if (busy) return;
    setTried(true);
    if (emailError) return;
    const to = email.trim();
    setBusy(true);
    const ok = host ? await host.sendReset(to) : true;
    setBusy(false);
    if (!ok) return;
    setTried(false);
    setSentTo(to);
  };

  const save = async () => {
    if (busy || !sentTo) return;
    setTried(true);
    if (codeError(code) || passwordError) return;
    setBusy(true);
    if (!host) return void setTimeout(onDone, 450);
    await host.resetPassword({ email: sentTo, code, password });
    setBusy(false);
  };

  return (
    <Glide id={sentTo ? 'code' : 'email'} direction={sentTo ? 1 : -1}>
      <form
        noValidate
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          void (sentTo ? save() : send());
        }}
      >
        <header className="flex flex-col items-start gap-4">
          <span className="nx-empty-icon mb-0" aria-hidden="true">
            {sentTo ? <KeyRound size={28} /> : <Mail size={28} />}
          </span>
          <h1 ref={title} tabIndex={-1} className="nx-page-title outline-none">
            {sentTo ? 'Choose a new password' : 'Reset your password'}
          </h1>
          <p className="text-nx-body text-nx-ink-2">
            {sentTo ? (
              <>
                We sent a code to{' '}
                <strong className="font-semibold break-words text-nx-ink">
                  {sentTo}
                </strong>
                . Enter it with your new password.
              </>
            ) : (
              'We’ll email you a code to choose a new one.'
            )}
          </p>
        </header>
        <GlassCard className="flex flex-col gap-5">
          {sentTo ? (
            <>
              <CodeField
                value={code}
                onChange={setCode}
                error={tried ? codeError(code) : undefined}
              />
              <PasswordField
                label="New password"
                autoComplete="new-password"
                value={password}
                onChange={setPassword}
                hint={`At least ${MIN_PASSWORD} characters.`}
                error={tried ? passwordError : undefined}
              />
            </>
          ) : (
            <TextField
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              label="Email"
              value={email}
              onChange={setEmail}
              error={tried ? emailError : undefined}
            />
          )}
          <Button type="submit" variant="primary" size="lg" full loading={busy}>
            {sentTo ? 'Save password and sign in' : 'Email me a code'}
          </Button>
        </GlassCard>
        <div className="-ml-3 flex flex-wrap gap-x-2 gap-y-1">
          {sentTo && (
            <Button
              variant="quiet"
              icon={RotateCcw}
              onClick={async () => {
                if (!host || (await host.sendReset(sentTo)))
                  toast(`Sent a new code to ${sentTo}`);
              }}
            >
              Send a new code
            </Button>
          )}
          <Button variant="quiet" icon={ArrowLeft} onClick={onBack}>
            Back to sign in
          </Button>
        </div>
      </form>
    </Glide>
  );
}
