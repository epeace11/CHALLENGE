'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, MailCheck, RotateCcw } from 'lucide-react';
import { Button, GlassCard, useToast } from '@/components/next/ui';
import { CodeField } from './fields';
import { codeError } from './form';
import type { SignupMode } from './mode';

/**
 * "Check your email", after "Email me a sign-in link": the email has a link and a six-digit code, so
 * it works on another device too. The main action finishes signing up or signing in.
 */
export function SentPanel({
  email,
  mode,
  onDone,
  onBack,
}: {
  email: string;
  mode: SignupMode;
  onDone: () => void;
  onBack: () => void;
}) {
  const toast = useToast();
  const [code, setCode] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const error = codeError(code);
  // The form this replaced is gone, so move focus to the title: screen readers read the new step,
  // and phones keep their keyboard down while someone goes to their email.
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => title.current?.focus({ preventScroll: true }), []);

  const submit = () => {
    if (busy) return;
    setTried(true);
    if (error) return;
    setBusy(true);
    setTimeout(onDone, 450);
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <header className="flex flex-col items-start gap-4">
        <span className="nx-empty-icon mb-0" aria-hidden="true">
          <MailCheck size={28} />
        </span>
        <h1 ref={title} tabIndex={-1} className="nx-page-title outline-none">
          Check your email
        </h1>
        <p className="text-nx-body text-nx-ink-2">
          We sent a sign-in link to{' '}
          <strong className="font-semibold break-words text-nx-ink">
            {email}
          </strong>
          . Open it on this device, or enter the code from the email.
        </p>
      </header>
      <GlassCard className="flex flex-col gap-5">
        <CodeField
          value={code}
          onChange={setCode}
          error={tried ? error : undefined}
        />
        <Button type="submit" variant="primary" size="lg" full loading={busy}>
          {mode === 'signup' ? 'Create account' : 'Sign in'}
        </Button>
      </GlassCard>
      <div className="-ml-3 flex flex-wrap gap-x-2 gap-y-1">
        <Button
          variant="quiet"
          icon={RotateCcw}
          onClick={() => toast(`Sent a new link to ${email}`)}
        >
          Send a new link
        </Button>
        <Button variant="quiet" icon={ArrowLeft} onClick={onBack}>
          Use a different email
        </Button>
      </div>
    </form>
  );
}
