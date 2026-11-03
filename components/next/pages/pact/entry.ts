import type { Challenge } from '@/lib/next/model';

/**
 * Where the pact opens. After Invite's Accept it opens on the signature: the partner has just read
 * the start, the stakes and every rule on Invite. Back still steps through them. Pages in the
 * preview have no URLs of their own, so Invite says so before it moves on (like Sign up's mode).
 */
let fromInvite = false;

/** Invite's Accept: the pact opens on its last step. */
export function openPactAtSignature() {
  fromInvite = true;
}

/** True when the pact should open on its signature. */
export const pactFromInvite = () => fromInvite;

/** Called once the pact has opened, so a later visit starts at step 1. */
export function forgetPactFromInvite() {
  fromInvite = false;
}

/**
 * Set up's last button in the preview: the pact opens for the one who set it up, on the challenge as
 * drafted (the sample world's own challenge is already running).
 */
let drafted: Challenge | null = null;

export function openPactAsSetter(c: Challenge) {
  drafted = c;
}

/** The drafted challenge, while the pact opened from Set up. */
export const pactAsSetter = () => drafted;

/** Called once the pact has opened, so a later visit shows the sample pact again. */
export function forgetPactAsSetter() {
  drafted = null;
}
