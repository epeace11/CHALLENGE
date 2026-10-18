'use client';
import { createContext, useCallback, useContext, useMemo } from 'react';
import type {
  Challenge,
  DateString,
  Proof,
  Rule,
  SavedChallenge,
  Theme,
  World,
} from '@/lib/next/model';
import type { CheckinInput } from '@/lib/next/actions';
import { useDemo } from './world';

/**
 * What pages do, for both hosts. A page calls `act(command, change)`: `change` is the pure update
 * from lib/next/actions.ts (the preview applies it to the sample world, and the live app applies it
 * at once while the database catches up); `command` is the same thing as data, which the live app
 * (components/live/) sends to the database. The preview has no host, so nothing leaves the page.
 *
 * Account, setup and upload steps that are not world changes go through `host` when there is one;
 * without it a page keeps its preview behaviour.
 */

export type Command =
  | { type: 'saveCheckin'; input: CheckinInput }
  | { type: 'approve'; entryId: string }
  | { type: 'rejectCorrection'; entryId: string }
  | { type: 'dispute'; entryId: string; comment: string }
  | { type: 'concede'; disputeId: string }
  | { type: 'withdrawDispute'; disputeId: string }
  | { type: 'replyToDispute'; disputeId: string; reply: string }
  | { type: 'askForgiveness'; pointId: string; reason: string }
  | {
      type: 'decideForgiveness';
      requestId: string;
      decision: 'approved' | 'denied';
    }
  | { type: 'forgivePoint'; pointId: string }
  | { type: 'addNote'; day: DateString; text: string }
  | { type: 'editNote'; noteId: string; text: string }
  | { type: 'removeNote'; noteId: string }
  | { type: 'signPact' }
  | { type: 'rename'; name: string }
  | { type: 'setShareLink'; savedId: string; on: boolean }
  | { type: 'saveAs'; challengeId: string; name: string };

/** Where a new challenge starts from on the Start page. */
export type Template =
  | { kind: 'blank' }
  | { kind: 'theme'; theme: Theme }
  | { kind: 'saved'; saved: SavedChallenge }
  /** Run a finished challenge again. */
  | { kind: 'again'; challenge: Challenge };

/** The challenge as Set up edits it. */
export type SetupDraft = {
  name: string;
  start: DateString;
  days: number;
  timeZone: string;
  deadline: { daysAfter: number; time: string };
  step: number;
  cap: number | null;
  rules: Rule[];
};

/** What the live app adds. Every call shows its own error and returns false when it fails. */
export type Host = {
  /** Sends a command to the database (after its change is already on screen). */
  send: (command: Command) => Promise<boolean>;
  /** Asks for a screenshot and uploads it; null when the person cancels. */
  pickProof: (day: DateString) => Promise<Proof | null>;
  /** 'in' when signed in at once, 'confirm' when the email has to be confirmed first. */
  signUp: (a: {
    name: string;
    email: string;
    password: string;
  }) => Promise<'in' | 'confirm' | false>;
  signIn: (a: { email: string; password: string }) => Promise<boolean>;
  /** Emails a sign-in link and code. */
  sendLink: (a: { email: string; name?: string }) => Promise<boolean>;
  /** Signs in with the 6-digit code from that email. */
  verifyCode: (a: { email: string; code: string }) => Promise<boolean>;
  signOut: () => Promise<void>;
  /** Creates a new challenge in setup from a template, and opens Set up. */
  startFrom: (template: Template) => Promise<boolean>;
  /** Saves Set up and moves on: the invite, or the pact when the partner is already in. */
  finishSetup: (draft: SetupDraft) => Promise<boolean>;
  /** The invite link for the partner, made on first ask. */
  inviteLink: () => Promise<{ link: string; code: string } | null>;
  /** The partner accepts the invite they opened. */
  acceptInvite: () => Promise<boolean>;
};

type Backend = {
  /** True in the live app: changes go to the database and can't be undone from a toast. */
  live: boolean;
  /** Applies a change on screen and, in the live app, saves it. */
  act: (command: Command | Command[], change: (w: World) => World) => void;
  /** Takes back the last change; only in the preview (check `canUndo`). */
  undo: () => void;
  canUndo: boolean;
  host: Host | null;
};

export const HostContext = createContext<{
  host: Host;
  apply: (change: (w: World) => World) => void;
} | null>(null);

/** The page's way to change things. See the comment at the top of this file. */
export function useBackend(): Backend {
  const live = useContext(HostContext);
  const { update, undo } = useDemo();
  const act = useCallback(
    (command: Command | Command[], change: (w: World) => World) => {
      if (!live) return update(change);
      live.apply(change);
      const host = live.host;
      void (async () => {
        for (const c of Array.isArray(command) ? command : [command])
          if (!(await host.send(c))) break;
      })();
    },
    [live, update],
  );
  return useMemo(
    () => ({
      live: !!live,
      act,
      undo: live ? () => {} : undo,
      canUndo: !live,
      host: live?.host ?? null,
    }),
    [live, act, undo],
  );
}

/** A toast's Undo button, only where Undo works (the preview). */
export function useUndoAction() {
  const { canUndo, undo } = useBackend();
  return (onUndo?: () => void) =>
    canUndo
      ? {
          action: {
            label: 'Undo',
            onClick: () => {
              undo();
              onUndo?.();
            },
          },
        }
      : {};
}
