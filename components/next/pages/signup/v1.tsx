// Version 1: a Sign up / Sign in switch at the top of the form; "Email me a sign-in link" is the outlined button under the main one.
'use client';
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
import { OrDivider, PasswordField } from './fields';
import { MIN_PASSWORD } from './form';
import type { SignupMode } from './mode';
import { SentPanel } from './sent';
import { useSignupForm } from './use-signup-form';

const MODES: { value: SignupMode; label: string }[] = [
  { value: 'signup', label: 'Sign up' },
  { value: 'signin', label: 'Sign in' },
];

/** Sign up and sign in, version 1. */
export default function SignupV1() {
  const f = useSignupForm();
  const still = useReducedMotion();
  const signup = f.mode === 'signup';
  const slide = { duration: still ? 0 : DURATION.base, ease: EASE };

  return (
    <PlainFrame back={{ to: 'landing' }} width="narrow" center>
      <div className="pt-2 pb-10">
        <Glide id={f.sentTo ? 'sent' : 'form'} direction={f.direction}>
          {f.sentTo ? (
            <SentPanel
              email={f.sentTo}
              mode={f.mode}
              onDone={f.finish}
              onBack={f.back}
            />
          ) : (
            <div className="flex flex-col gap-6">
              <SegmentedControl
                label="Sign up or sign in"
                value={f.mode}
                onChange={f.setMode}
                options={MODES}
                className="nx-enter"
              />
              <Glide id={f.mode} direction={f.direction}>
                <header className="flex flex-col gap-2">
                  <h1 className="nx-page-title">
                    {signup ? 'Create your account' : 'Sign in'}
                  </h1>
                  {signup && (
                    <p className="text-nx-body text-nx-ink-2">
                      Then pick a challenge and invite your partner.
                    </p>
                  )}
                </header>
              </Glide>
              <Enter index={1}>
                <GlassCard>
                  <form
                    noValidate
                    className="flex flex-col"
                    onSubmit={(e) => {
                      e.preventDefault();
                      f.submit('password', e.currentTarget);
                    }}
                  >
                    <Presence initial={false}>
                      {signup && (
                        <motion.div
                          key="name"
                          initial={{
                            height: 0,
                            opacity: 0,
                            overflow: 'hidden',
                          }}
                          animate={{
                            height: 'auto',
                            opacity: 1,
                            transitionEnd: { overflow: 'visible' },
                          }}
                          exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
                          transition={slide}
                        >
                          <div className="pb-5" onBlur={f.leave('name')}>
                            <TextField
                              name="name"
                              label="First name"
                              autoComplete="given-name"
                              value={f.draft.name}
                              onChange={f.set('name')}
                              error={f.errorFor('name')}
                            />
                          </div>
                        </motion.div>
                      )}
                    </Presence>
                    <div className="flex flex-col gap-5">
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
                      <PasswordField
                        label="Password"
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
                      <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        full
                        loading={f.busy}
                        iconEnd={ArrowRight}
                        className="mt-1"
                      >
                        {signup ? 'Create account' : 'Sign in'}
                      </Button>
                      <OrDivider />
                      <Button
                        icon={Mail}
                        full
                        onClick={(e) => f.submit('link', e.currentTarget.form)}
                      >
                        Email me a sign-in link
                      </Button>
                    </div>
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
