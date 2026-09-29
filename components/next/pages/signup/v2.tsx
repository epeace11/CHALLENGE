// Version 2: no tabs: the title says which form it is, with Sign in or Sign up at the top right; a two-way choice picks a password or an emailed link.
'use client';
import { useState } from 'react';
import { ArrowRight, Mail } from 'lucide-react';
import { PlainFrame } from '@/components/next/frames';
import {
  Button,
  DURATION,
  EASE,
  Enter,
  GlassCard,
  Glide,
  Presence,
  SegmentedControl,
  TextField,
  motion,
  useReducedMotion,
} from '@/components/next/ui';
import { PasswordField } from './fields';
import { MIN_PASSWORD, type Method } from './form';
import { SentPanel } from './sent';
import { useSignupForm } from './use-signup-form';

const METHODS: { value: Method; label: string }[] = [
  { value: 'password', label: 'Use a password' },
  { value: 'link', label: 'Email me a link' },
];

/** Sign up and sign in, version 2. */
export default function SignupV2() {
  const f = useSignupForm();
  const still = useReducedMotion();
  const [method, setMethod] = useState<Method>('password');
  const signup = f.mode === 'signup';
  const slide = { duration: still ? 0 : DURATION.base, ease: EASE };
  const action =
    method === 'link'
      ? 'Email me a sign-in link'
      : signup
        ? 'Create account'
        : 'Sign in';

  return (
    <PlainFrame
      back={{ to: 'landing' }}
      width="narrow"
      center
      aside={
        f.sentTo ? undefined : (
          <Button
            variant="quiet"
            className="-mr-3"
            onClick={() => f.setMode(signup ? 'signin' : 'signup')}
          >
            {signup ? 'Sign in' : 'Sign up'}
          </Button>
        )
      }
    >
      <div className="pt-2 pb-10">
        <Glide id={f.sentTo ? 'sent' : f.mode} direction={f.direction}>
          {f.sentTo ? (
            <SentPanel
              email={f.sentTo}
              mode={f.mode}
              onDone={f.finish}
              onBack={f.back}
            />
          ) : (
            <div className="flex flex-col gap-6">
              <header className="nx-enter flex flex-col gap-2">
                <h1 className="nx-page-title">
                  {signup ? 'Create your account' : 'Sign in'}
                </h1>
                {signup && (
                  <p className="text-nx-body text-nx-ink-2">
                    Then pick a challenge and invite your partner.
                  </p>
                )}
              </header>
              <Enter index={1}>
                <GlassCard>
                  <form
                    noValidate
                    className="flex flex-col gap-5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      f.submit(method, e.currentTarget);
                    }}
                  >
                    {signup && (
                      <div onBlur={f.leave('name')}>
                        <TextField
                          name="name"
                          label="First name"
                          autoComplete="given-name"
                          value={f.draft.name}
                          onChange={f.set('name')}
                          error={f.errorFor('name')}
                        />
                      </div>
                    )}
                    <div onBlur={f.leave('email')}>
                      <TextField
                        name="email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        label="Email"
                        value={f.draft.email}
                        onChange={f.set('email')}
                        error={f.errorFor('email')}
                      />
                    </div>
                    <SegmentedControl
                      label={signup ? 'How you will sign in' : 'How to sign in'}
                      value={method}
                      onChange={setMethod}
                      options={METHODS}
                    />
                    <Presence initial={false}>
                      {method === 'password' && (
                        <motion.div
                          key="password"
                          initial={{
                            height: 0,
                            opacity: 0,
                            marginTop: -20,
                            overflow: 'hidden',
                          }}
                          animate={{
                            height: 'auto',
                            opacity: 1,
                            marginTop: 0,
                            transitionEnd: { overflow: 'visible' },
                          }}
                          exit={{
                            height: 0,
                            opacity: 0,
                            marginTop: -20,
                            overflow: 'hidden',
                          }}
                          transition={slide}
                        >
                          <PasswordField
                            label={signup ? 'Choose a password' : 'Password'}
                            autoComplete={
                              signup ? 'new-password' : 'current-password'
                            }
                            value={f.draft.password}
                            onChange={f.set('password')}
                            onBlur={f.leave('password')}
                            hint={
                              signup
                                ? `At least ${MIN_PASSWORD} characters.`
                                : undefined
                            }
                            error={f.errorFor('password')}
                          />
                        </motion.div>
                      )}
                    </Presence>
                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      full
                      loading={f.busy}
                      icon={method === 'link' ? Mail : undefined}
                      iconEnd={method === 'link' ? undefined : ArrowRight}
                      className="mt-1"
                    >
                      {action}
                    </Button>
                  </form>
                </GlassCard>
              </Enter>
            </div>
          )}
        </Glide>
      </div>
    </PlainFrame>
  );
}
