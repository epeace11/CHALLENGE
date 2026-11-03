/**
 * A theme tapped on the landing page before signing up. Start opens on it after sign-up, instead
 * of its list of ways to start. Pages have no URLs of their own, so Landing says so before moving on
 * (like Sign up's mode).
 */
let wanted: string | null = null;

/** Landing: this theme was tapped. */
export function wantTheme(id: string) {
  wanted = id;
}

/** Start: the theme tapped on Landing, if any. */
export const wantedTheme = () => wanted;

/** Start, once it has opened on it, so a later visit opens on the list. */
export function forgetWantedTheme() {
  wanted = null;
}
