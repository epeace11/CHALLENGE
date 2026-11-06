import type { PastChallenge, World } from '@/lib/next/model';

/**
 * Which finished challenge the verdict shows. Pages in the preview have no URLs of their own, so
 * the card that opens a verdict (on Your challenges) says which one first; without one it is the
 * newest.
 */
let chosen: string | null = null;

/** Sets the challenge the verdict opens on (call it before navigate('verdict')). */
export function showVerdictFor(challengeId: string) {
  chosen = challengeId;
}

/** The finished challenge to show: the one chosen, the one on screen, or the newest not hidden. */
export const pastToShow = (w: World): PastChallenge | undefined =>
  w.past.find((p) => p.challenge.id === chosen && !p.hidden) ??
  w.past.find((p) => p.challenge.id === w.challenge.id && !p.hidden) ??
  w.past.find((p) => !p.hidden);
