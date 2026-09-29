import type {
  Challenge,
  DateString,
  Entry,
  Point,
  Proof,
  World,
} from './model.ts';
import { isClosed } from './calendar.ts';
import {
  entryFor,
  meetsTarget,
  pendingRequestFor,
  pointOfEntry,
  ruleById,
} from './selectors.ts';

/**
 * What people do, as pure World → World updates for the preview (no database). Each returns a new
 * world and never changes the one passed in; an action that does not apply returns it unchanged.
 * In a page: `const { update } = useDemo(); update((w) => approve(w, entry.id))`.
 */

/** A fresh id: `prefix-n`, the first n not taken. */
function newId(prefix: string, taken: { id: string }[]) {
  let n = taken.length + 1;
  while (taken.some((t) => t.id === `${prefix}-${n}`)) n++;
  return `${prefix}-${n}`;
}

const replace = <T extends { id: string }>(
  list: T[],
  id: string,
  next: Partial<T>,
) => list.map((x) => (x.id === id ? { ...x, ...next } : x));

/** Voids an entry's active point and drops a pending forgiveness request on it (the answer changed). */
function voidPointOf(w: World, entryId: string): World {
  const point = pointOfEntry(w, entryId);
  if (!point) return w;
  return {
    ...w,
    points: replace(w.points, point.id, { voided: true }),
    requests: w.requests.filter(
      (r) => !(r.pointId === point.id && r.status === 'pending'),
    ),
  };
}

/** Adds a point for an entry's miss. */
function addPoint(w: World, entry: Entry, reason: Point['reason']): World {
  const point: Point = {
    id: newId('point', w.points),
    personId: entry.personId,
    ruleId: entry.ruleId,
    day: entry.day,
    reason,
    entryId: entry.id,
    forgiven: false,
    voided: false,
    createdAt: w.now,
  };
  return { ...w, points: [...w.points, point] };
}

export type CheckinInput = {
  personId: string;
  ruleId: string;
  day: DateString;
  /** Yes or No (Yes-or-No and weekly rules). */
  done?: boolean;
  /** Number rules: what was logged; done is worked out from the target. */
  value?: number;
  note?: string;
  proofs?: Proof[];
  /** With a No: the reason for asking the partner to forgive it. */
  forgiveness?: string;
};

/**
 * One whole check-in, like the app's Save. Before the deadline it is the answer: a Yes waits for
 * the partner's review, a No is a point (with an optional forgiveness request), and a weekly
 * rule's No costs nothing. After the deadline it is a late answer the partner has to approve.
 */
export function saveCheckin(w: World, input: CheckinInput): World {
  const c = w.challenge,
    rule = ruleById(c, input.ruleId);
  if (!rule) return w;
  const done =
    rule.kind === 'number'
      ? input.value !== undefined &&
        !!rule.target &&
        meetsTarget(rule.target, input.value)
      : !!input.done;
  const existing = entryFor(w, input.personId, input.ruleId, input.day),
    note = input.note ?? '',
    proofs = input.proofs ?? [];
  const value = rule.kind === 'number' ? input.value : undefined;
  if (isClosed(c, input.day, w.now)) {
    const correction = { done, value, note, proofs, proposedAt: w.now };
    if (existing)
      return { ...w, entries: replace(w.entries, existing.id, { correction }) };
    const entry: Entry = {
      id: newId('entry', w.entries),
      personId: input.personId,
      ruleId: input.ruleId,
      day: input.day,
      done: null,
      status: 'unlogged',
      note: '',
      proofs: [],
      correction,
    };
    return { ...w, entries: [...w.entries, entry] };
  }
  let next = existing ? voidPointOf(w, existing.id) : w;
  const entry: Entry = {
    id: existing?.id ?? newId('entry', w.entries),
    personId: input.personId,
    ruleId: input.ruleId,
    day: input.day,
    done,
    ...(value !== undefined ? { value } : {}),
    status: done ? 'pending' : rule.kind === 'weekly' ? 'confirmed' : 'missed',
    note,
    proofs,
    loggedAt: w.now,
  };
  next = {
    ...next,
    entries: existing
      ? next.entries.map((e) => (e.id === entry.id ? entry : e))
      : [...next.entries, entry],
  };
  if (entry.status !== 'missed') return next;
  next = addPoint(next, entry, 'missed');
  const reason = input.forgiveness?.trim();
  if (!reason) return next;
  const point = next.points[next.points.length - 1];
  return askForgiveness(next, point.id, reason);
}

/** Approves the partner's answer, or their late answer (which then replaces the old one). */
export function approve(w: World, entryId: string): World {
  const e = w.entries.find((x) => x.id === entryId);
  if (!e) return w;
  if (!e.correction)
    return e.status === 'pending'
      ? { ...w, entries: replace(w.entries, e.id, { status: 'confirmed' }) }
      : w;
  const { done, value, note, proofs } = e.correction;
  const rule = ruleById(w.challenge, e.ruleId);
  const hadPoint = !!pointOfEntry(w, e.id);
  const updated: Entry = {
    ...e,
    done,
    value,
    note,
    proofs,
    correction: undefined,
    loggedAt: w.now,
    status: done
      ? 'confirmed'
      : rule?.kind === 'weekly'
        ? 'confirmed'
        : 'missed',
  };
  let next: World = {
    ...w,
    entries: w.entries.map((x) => (x.id === e.id ? updated : x)),
  };
  if (done && hadPoint) next = voidPointOf(next, e.id);
  if (!done && !hadPoint && updated.status === 'missed')
    next = addPoint(next, updated, 'missed');
  return next;
}

/** Turns down a late answer; the old answer stands. */
export function rejectCorrection(w: World, entryId: string): World {
  return {
    ...w,
    entries: replace(w.entries, entryId, { correction: undefined }),
  };
}

/** Disputes an answer: it waits until its owner concedes or the dispute is withdrawn. */
export function dispute(
  w: World,
  entryId: string,
  raisedBy: string,
  comment: string,
): World {
  const e = w.entries.find((x) => x.id === entryId);
  if (!e || e.personId === raisedBy) return w;
  return {
    ...w,
    entries: replace(w.entries, entryId, { status: 'disputed' }),
    disputes: [
      ...w.disputes,
      {
        id: newId('dispute', w.disputes),
        entryId,
        raisedBy,
        comment: comment.trim(),
        status: 'open',
        createdAt: w.now,
      },
    ],
  };
}

/** The answer's owner accepts the dispute: the answer becomes a miss with a point. */
export function concede(w: World, disputeId: string): World {
  const d = w.disputes.find((x) => x.id === disputeId),
    e = d && w.entries.find((x) => x.id === d.entryId);
  if (!d || !e || d.status !== 'open') return w;
  const next: World = {
    ...w,
    disputes: replace(w.disputes, d.id, {
      status: 'conceded',
      resolvedAt: w.now,
    }),
    entries: replace(w.entries, e.id, { status: 'conceded' }),
  };
  return addPoint(next, { ...e, status: 'conceded' }, 'conceded');
}

/** Whoever raised the dispute takes it back: the answer counts as it was. */
export function withdrawDispute(w: World, disputeId: string): World {
  const d = w.disputes.find((x) => x.id === disputeId);
  if (!d || d.status !== 'open') return w;
  return {
    ...w,
    disputes: replace(w.disputes, d.id, {
      status: 'withdrawn',
      resolvedAt: w.now,
    }),
    entries: replace(w.entries, d.entryId, { status: 'confirmed' }),
  };
}

/** The answer's owner replies to a dispute; it stays open. */
export function replyToDispute(
  w: World,
  disputeId: string,
  reply: string,
): World {
  return {
    ...w,
    disputes: replace(w.disputes, disputeId, { reply: reply.trim() }),
  };
}

/** The point's owner asks their partner to forgive it. One pending request per point. */
export function askForgiveness(
  w: World,
  pointId: string,
  reason: string,
): World {
  const point = w.points.find((p) => p.id === pointId);
  if (!point || point.forgiven || point.voided || pendingRequestFor(w, pointId))
    return w;
  return {
    ...w,
    requests: [
      ...w.requests,
      {
        id: newId('request', w.requests),
        pointId,
        from: point.personId,
        reason: reason.trim(),
        status: 'pending',
        createdAt: w.now,
      },
    ],
  };
}

/** Marks a point forgiven: it costs nothing and its answer shows as forgiven. */
function forgive(w: World, pointId: string): World {
  const point = w.points.find((p) => p.id === pointId);
  if (!point) return w;
  return {
    ...w,
    points: replace(w.points, pointId, { forgiven: true }),
    entries: point.entryId
      ? replace(w.entries, point.entryId, { status: 'excused' })
      : w.entries,
  };
}

/** The partner decides a forgiveness request. */
export function decideForgiveness(
  w: World,
  requestId: string,
  decision: 'approved' | 'denied',
): World {
  const r = w.requests.find((x) => x.id === requestId);
  if (!r || r.status !== 'pending') return w;
  const next = {
    ...w,
    requests: replace(w.requests, requestId, {
      status: decision,
      decidedAt: w.now,
    }),
  };
  return decision === 'approved' ? forgive(next, r.pointId) : next;
}

/** The partner forgives a point without being asked. */
export const forgivePoint = (w: World, pointId: string): World =>
  forgive(w, pointId);

export function addNote(
  w: World,
  personId: string,
  day: DateString,
  text: string,
): World {
  const trimmed = text.trim();
  if (!trimmed) return w;
  return {
    ...w,
    journal: [
      ...w.journal,
      {
        id: newId('note', w.journal),
        personId,
        day,
        text: trimmed,
        createdAt: w.now,
      },
    ],
  };
}

export const editNote = (w: World, noteId: string, text: string): World =>
  text.trim()
    ? { ...w, journal: replace(w.journal, noteId, { text: text.trim() }) }
    : removeNote(w, noteId);

export const removeNote = (w: World, noteId: string): World => ({
  ...w,
  journal: w.journal.filter((n) => n.id !== noteId),
});

/** Signs the pact for one person. */
export function signPact(w: World, personId: string): World {
  return {
    ...w,
    pact: {
      ...w.pact,
      signatures: w.pact.signatures.map((s) =>
        s.personId === personId ? { ...s, signedAt: s.signedAt ?? w.now } : s,
      ),
    },
  };
}

/** Changes the running challenge's settings (name, look, step, cap, deadline, rules…). */
export function updateChallenge(
  w: World,
  patch: Partial<Omit<Challenge, 'id' | 'coupleId'>>,
): World {
  return { ...w, challenge: { ...w.challenge, ...patch } };
}

/** Turns a saved challenge's share link on or off. */
export function setShareLink(w: World, savedId: string, on: boolean): World {
  return { ...w, saved: replace(w.saved, savedId, { linkOn: on }) };
}

/** Sends (or re-sends) the invite to the partner. */
export function sendInvite(
  w: World,
  to: { name: string; email: string },
): World {
  return { ...w, invite: { ...w.invite, to, status: 'sent', sentAt: w.now } };
}
