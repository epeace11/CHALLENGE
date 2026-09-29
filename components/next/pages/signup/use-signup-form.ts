'use client';
import { useState } from 'react';
import { useNav } from '@/components/next/nav';
import { FIELDS, validate, type Draft, type Field, type Method } from './form';
import { setSignupMode, signupMode, type SignupMode } from './mode';

/** How long the main button shows its spinner before moving on, like a real request would. */
const WAIT_MS = 450;

/**
 * The state both versions of Sign up share: which form is on screen, what has been typed, which
 * errors to show, and where each action leads. Creating an account opens Start; signing in opens
 * Your challenges. An emailed link opens the "Check your email" step first.
 *
 * Errors show once a field has something in it and loses focus, and for every field after the
 * first tap on the main action; they update as you type, so a fixed field clears at once.
 */
export function useSignupForm() {
  const { navigate } = useNav();
  const [mode, setModeState] = useState<SignupMode>(signupMode);
  const [draft, setDraft] = useState<Draft>({
    name: '',
    email: '',
    password: '',
  });
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [tried, setTried] = useState<Method | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  /** Which way the next swap slides: forward (1) to sign in or the email step, back (-1) otherwise. */
  const [direction, setDirection] = useState<1 | -1>(1);

  const errors = validate(draft, mode, tried ?? 'password');
  const errorFor = (field: Field) =>
    tried || touched[field] ? errors[field] : undefined;

  const setMode = (next: SignupMode) => {
    if (next === mode) return;
    setSignupMode(next);
    setModeState(next);
    setDirection(next === 'signin' ? 1 : -1);
    setTouched({});
    setTried(null);
  };

  const set = (field: Field) => (value: string) =>
    setDraft((d) => ({ ...d, [field]: value }));

  /** Marks a field as done once it has something in it, so its error can show. */
  const leave = (field: Field) => () => {
    if (draft[field].trim())
      setTouched((t) => (t[field] ? t : { ...t, [field]: true }));
  };

  const goOn = () => navigate(mode === 'signup' ? 'start' : 'home');

  /**
   * The main action (a password) or the emailed link: check the fields, then go on. `form` is the
   * form the tap came from, to move focus to the first field that needs fixing.
   */
  const submit = (method: Method, form: HTMLFormElement | null) => {
    if (busy) return;
    setTried(method);
    const found = validate(draft, mode, method);
    const first = FIELDS.find((f) => found[f]);
    if (first) {
      form?.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus();
      return;
    }
    if (method === 'link') {
      setDirection(1);
      setSentTo(draft.email.trim());
      return;
    }
    setBusy(true);
    setTimeout(goOn, WAIT_MS);
  };

  /** Back from "Check your email" to the form, keeping what was typed, with the email field focused. */
  const back = () => {
    setDirection(-1);
    setSentTo(null);
    setTried(null);
    setTimeout(() =>
      document.querySelector<HTMLInputElement>('input[name="email"]')?.focus(),
    );
  };

  return {
    mode,
    setMode,
    draft,
    set,
    leave,
    errorFor,
    submit,
    busy,
    sentTo,
    back,
    finish: goOn,
    direction,
  };
}
