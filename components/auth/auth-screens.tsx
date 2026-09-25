'use client';
import { useState, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { challengeRange } from '@/lib/dates';

/** Busy and error state for one auth form. */
function useAuthTask() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const run = async (fn: () => Promise<unknown>) => {
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Something went wrong. Please retry.',
      );
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

const submitWith = (fn: () => void) => (e: { preventDefault(): void }) => {
  e.preventDefault();
  fn();
};

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <div className="brand">30 DAY CHALLENGE</div>
      {children}
    </div>
  );
}

function Field({
  id,
  label,
  ...input
}: {
  id: string;
  label: string;
  type: string;
  autoComplete: string;
  value: string;
  onChange: (v: string) => void;
  minLength?: number;
}) {
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        required
        {...input}
        onChange={(e) => input.onChange(e.target.value)}
      />
    </div>
  );
}

const ErrorText = ({ error }: { error: string }) =>
  error ? (
    <p role="alert" className="error">
      {error}
    </p>
  ) : null;

/** Sign in, request a reset link, and the "link sent" confirmation. */
export function SignInScreen() {
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [mode, setMode] = useState<'signin' | 'forgot' | 'sent'>('signin');
  const { busy, error, setError, run } = useAuthTask();
  const switchTo = (m: typeof mode) => {
    setError('');
    setMode(m);
  };
  return (
    <AuthShell>
      {mode === 'signin' ? (
        <form
          className="glass login"
          onSubmit={submitWith(
            () =>
              void run(async () => {
                const { error } = await supabase.auth.signInWithPassword({
                  email: email.trim(),
                  password,
                });
                if (error) throw error;
                setPassword('');
              }),
          )}
        >
          <p className="eyebrow">ERIN & KAZZY · {challengeRange}</p>
          <h1>
            Show up.
            <br />
            <span>For each other.</span>
          </h1>
          <Field
            id="email"
            label="Email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={setEmail}
          />
          <Field
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
          />
          <ErrorText error={error} />
          <button className="primary full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={16} />
          </button>
          <button
            type="button"
            className="text-link forgot"
            onClick={() => switchTo('forgot')}
          >
            Forgot your password?
          </button>
        </form>
      ) : mode === 'forgot' ? (
        <form
          className="glass login"
          onSubmit={submitWith(
            () =>
              void run(async () => {
                const { error } = await supabase.auth.resetPasswordForEmail(
                  email.trim(),
                  { redirectTo: window.location.origin + '/' },
                );
                if (error) throw error;
                setMode('sent');
              }),
          )}
        >
          <p className="eyebrow">RESET PASSWORD</p>
          <h1>
            No worries.
            <br />
            <span>It happens.</span>
          </h1>
          <p className="muted">
            Enter your email and we’ll send you a link to choose a new password.
          </p>
          <Field
            id="reset-email"
            label="Email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={setEmail}
          />
          <ErrorText error={error} />
          <button className="primary full" disabled={busy}>
            {busy ? 'Sending…' : 'Send reset link'} <ArrowRight size={16} />
          </button>
          <button
            type="button"
            className="text-link forgot"
            onClick={() => switchTo('signin')}
          >
            Back to sign in
          </button>
        </form>
      ) : (
        <section className="glass login">
          <p className="eyebrow">CHECK YOUR EMAIL</p>
          <h1>
            Link sent.
            <br />
            <span>Go tap it.</span>
          </h1>
          <p className="muted">
            We emailed <b>{email.trim()}</b>. Open the link on this device and
            you’ll be asked to choose a new password. It can take a minute to
            arrive, and check spam if it doesn’t.
          </p>
          <button
            type="button"
            className="text-link forgot"
            onClick={() => switchTo('signin')}
          >
            Back to sign in
          </button>
        </section>
      )}
    </AuthShell>
  );
}

/** Choosing a new password after following a reset link. */
export function RecoveryScreen({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState(''),
    [password2, setPassword2] = useState('');
  const { busy, error, setError, run } = useAuthTask();
  return (
    <AuthShell>
      <form
        className="glass login"
        onSubmit={submitWith(() => {
          if (password !== password2) {
            setError('Those passwords don’t match.');
            return;
          }
          void run(async () => {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
            setPassword('');
            setPassword2('');
            onDone();
            window.history.replaceState(null, '', window.location.pathname);
          });
        })}
      >
        <p className="eyebrow">NEW PASSWORD</p>
        <h1>
          Choose a<br />
          <span>new password.</span>
        </h1>
        <Field
          id="new-password"
          label="New password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={setPassword}
        />
        <Field
          id="new-password-2"
          label="Repeat it"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={password2}
          onChange={setPassword2}
        />
        <ErrorText error={error} />
        <button className="primary full" disabled={busy}>
          {busy ? 'Saving…' : 'Save password'} <ArrowRight size={16} />
        </button>
      </form>
    </AuthShell>
  );
}
