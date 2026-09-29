/**
 * Which form Sign up opens on. Pages in the preview have no URLs of their own, so a page that sends
 * someone here to sign in (Landing's "Sign in") says so first. The page also remembers the form on
 * screen, so switching between versions keeps it.
 */
export type SignupMode = 'signup' | 'signin';

let current: SignupMode = 'signup';

/** The form Sign up opens on. */
export const signupMode = (): SignupMode => current;

/** Sets the form Sign up opens on (call it before navigate('signup')). */
export function setSignupMode(mode: SignupMode) {
  current = mode;
}
