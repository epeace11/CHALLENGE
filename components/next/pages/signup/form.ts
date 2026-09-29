import type { SignupMode } from './mode';

/** What the sign-up and sign-in forms check before they go on. Pure, so both versions share it. */

/** A password, or a sign-in link sent to the email address. */
export type Method = 'password' | 'link';
export type Field = 'name' | 'email' | 'password';
export type Draft = Record<Field, string>;
export type Errors = Partial<Record<Field, string>>;

export const MIN_PASSWORD = 8;

/** The fields in screen order, to focus the first one with an error. */
export const FIELDS: Field[] = ['name', 'email', 'password'];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** The error for each field that needs fixing; the first name only counts when signing up. */
export function validate(
  draft: Draft,
  mode: SignupMode,
  method: Method,
): Errors {
  const errors: Errors = {};
  if (mode === 'signup' && !draft.name.trim())
    errors.name = 'Enter your first name.';
  const email = draft.email.trim();
  if (!email) errors.email = 'Enter your email address.';
  else if (!EMAIL.test(email))
    errors.email = 'Enter a full email address, like name@example.com.';
  if (method === 'password') {
    if (!draft.password)
      errors.password =
        mode === 'signup' ? 'Choose a password.' : 'Enter your password.';
    else if (mode === 'signup' && draft.password.length < MIN_PASSWORD)
      errors.password = `Use at least ${MIN_PASSWORD} characters.`;
  }
  return errors;
}

/** The code in the sign-in email: six digits. */
export const CODE_LENGTH = 6;

export const codeError = (code: string) =>
  code.length === CODE_LENGTH
    ? undefined
    : code.length === 0
      ? 'Enter the code from the email.'
      : `The code has ${CODE_LENGTH} digits.`;
