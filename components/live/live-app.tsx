'use client';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { DateString, Proof, World } from '@/lib/next/model';
import { shift } from '@/lib/next/calendar';
import { formatDay } from '@/lib/next/selectors';
import {
  HostContext,
  type Host,
  type SetupDraft,
  type Template,
} from '@/components/next/backend';
import {
  NavContext,
  isPageId,
  type Nav,
  type PageId,
} from '@/components/next/nav';
import { pageById, preloadPages } from '@/components/next/pages/registry';
import { setSignupMode } from '@/components/next/pages/signup/mode';
import { showVerdictFor } from '@/components/next/pages/verdict/which';
import { NxRoot, useToast } from '@/components/next/ui';
import { HostedWorld } from '@/components/next/world';
import { world as signedOutWorld } from '@/lib/next/demo';
import * as api from '@/lib/live/api';
import {
  PENDING_PARTNER,
  buildWorld,
  inviteWorld,
  nextLock,
  withShared,
  type Built,
  type InvitePreviewRow,
  type ProofUrls,
  type Rows,
  type SharedRow,
} from '@/lib/live/world';
import { CantLoad, PageBoundary } from './cant-load';
import { InviteGone } from './invite-gone';
import { NewPassword } from './new-password';
import { failure } from './failure';
import { Waiting } from './waiting';

/** The browser tab's name where the preview's page title isn't what a person calls the page. */
const TAB_TITLES: Partial<Record<PageId, string>> = {
  signup: 'Sign in',
  shared: 'Shared challenge',
  setup: 'Set up',
};

/**
 * The Challenge for any couple, on the PROD CHALLENGE database, at /app. It signs people in, loads
 * everything their account can read, builds the same World the preview's sample data fills, and
 * shows the picked page versions from components/next/pages. Pages change things through
 * useBackend(); this file is the host that sends those changes to the database (lib/live/api.ts)
 * and reloads.
 *
 * Which pages someone can open depends on where their challenge stands (see `resolve`).
 */

const INVITE_KEY = 'nx-invite';
const SHARED_KEY = 'nx-shared';
const LINK_KEY = 'nx-invite-link';
/** The invite whose Accept was tapped before having an account: accepted once they're signed in. */
const ACCEPT_KEY = 'nx-invite-accept';
/** The challenge last opened on this device: with several, the app comes back to it. */
const OPEN_KEY = 'nx-open-challenge';

/** The invite token from the link (?invite=…), kept while its person signs up. */
let inviteToken: string | null = null;
/** A shared challenge's token from its link (?shared=…), kept the same way. */
let sharedToken: string | null = null;
/** ACCEPT_KEY's token, kept here instead in a browser that can't store it (private mode). */
let acceptAfter: string | null = null;
/** The challenge the invite link showed last, to tell "used by this account" from "expired". */
let lastInvite: { token: string; challenge: string } | null = null;
/** The shared challenge last shown, still shown when a load can't reach its link. */
let lastShared: { token: string; row: SharedRow } | null = null;
/** Counts loads, so only the newest one's rows land on screen. */
let loads = 0;

/**
 * A change a page made (useBackend().act) that is on screen before the database has it. Every load
 * that lands shows the fresh rows with these applied on top, oldest first, so a reload never takes
 * back a change that is still on its way. A change leaves the list when its write fails, or once a
 * load that began after its write succeeded lands (those rows have it).
 */
type Pending = {
  id: number;
  change: (w: World) => World;
  /** Once its write succeeded: `loads` at that moment. Loads numbered higher began after it. */
  savedAt?: number;
};
/** Numbers each change a page applies. */
let changes = 0;
/** Changes applied but not yet sent: act() applies its change and sends its command right after. */
let unclaimed: number[] = [];
/** Sends still on their way. */
let sending = 0;
/** A start or join is on its way (see `once` in Hosting). */
let joining = false;

/** `list` without the changes saved before load `load` began: that load's rows have them. */
function withoutSaved(list: Pending[], load: number) {
  const left = list.filter((p) => p.savedAt === undefined || p.savedAt >= load);
  return left.length === list.length ? list : left;
}

/** Fired a few seconds after a load fails, to try again. */
const RETRY_EVENT = 'nx-retry';
/** Opened from a password reset email's link (?reset=1): ask for the new password once signed in. */
let resetOpened = false;
/** Where to go once signed in: the page that sent someone to Sign up (the shared challenge). */
let afterSignIn: PageId | null = null;

/** The URL's query string, as a store pages re-render on (back and forward, and navigate below). */
const URL_EVENT = 'nx-url';
const subscribeUrl = (f: () => void) => {
  window.addEventListener('popstate', f);
  window.addEventListener(URL_EVENT, f);
  return () => {
    window.removeEventListener('popstate', f);
    window.removeEventListener(URL_EVENT, f);
  };
};
const search = () => location.search;
const noSearch = () => '';

const deviceZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const nowIso = () => new Date().toISOString();

/**
 * Kept in this browser: the invite or shared link someone opened (while they sign up, even in another
 * tab), and the invite link made for a partner (so the app shows the same one again, not a new one).
 */
const readStored = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
/** False when this browser can't keep it (private mode): links then live only in the URL. */
const writeStored = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

type Loaded =
  | { kind: 'loading' }
  | {
      kind: 'out';
      preview: InvitePreviewRow | null;
      shared: SharedRow | null;
    }
  | {
      kind: 'in';
      rows: Rows;
      urls: ProofUrls;
      preview: InvitePreviewRow | null;
      shared: SharedRow | null;
      /** When these rows landed (epoch ms). */
      at: number;
    };

const SIGNED_OUT: PageId[] = ['landing', 'signup'];
const RUNNING: PageId[] = [
  'overview',
  'log',
  // Every page inside a running challenge belongs here (tests/next.mjs checks it).
  'timer',
  'review',
  'progress',
  'gifts',
  'rules',
  'recap',
  'settings',
  'home',
  'practice',
  // A past challenge's verdict, opened from Your challenges.
  'verdict',
  // Another challenge can start alongside this one.
  'start',
];

/**
 * The page to show for `wanted`, given where the account stands. A shared challenge shows when its
 * link was just opened (`fromLink`) or the Shared page is asked for; an open invite comes first.
 */
function resolve(
  wanted: PageId | null,
  loaded: Loaded,
  built: Built | null,
  fromLink: boolean,
): PageId | 'waiting' {
  const page = resolveAccount(wanted, loaded, built);
  const invited =
    loaded.kind !== 'loading' && loaded.preview && page === 'invite';
  if (
    loaded.kind !== 'loading' &&
    loaded.shared &&
    !invited &&
    (wanted === 'shared' || (wanted === null && fromLink))
  )
    return 'shared';
  return page;
}

function resolveAccount(
  wanted: PageId | null,
  loaded: Loaded,
  built: Built | null,
): PageId | 'waiting' {
  const pick = (allowed: PageId[], fallback: PageId | 'waiting') =>
    wanted && allowed.includes(wanted) ? wanted : fallback;
  if (loaded.kind === 'out')
    return loaded.preview
      ? pick([...SIGNED_OUT, 'invite'], 'invite')
      : pick(SIGNED_OUT, 'landing');
  if (loaded.kind !== 'in' || !built) return 'landing';
  // An invite for a challenge this account isn't in yet.
  if (
    loaded.preview &&
    !loaded.rows.challenges.some((c) => c.id === loaded.preview?.challenge.id)
  )
    return 'invite';
  const c = built.current;
  // Nothing on screen, but hidden or saved ones: Your challenges is the way back to them.
  if (!c) {
    const kept = built.world.past.length + built.world.saved.length > 0;
    return pick(
      ['start', 'settings', 'home', 'verdict'],
      kept ? 'home' : 'start',
    );
  }
  switch (c.status) {
    // Your challenges (and a past verdict from it) stay open while the next one is set up.
    case 'draft':
      // One the partner is setting up is theirs: this person waits on Your challenges.
      if (c.created_by !== loaded.rows.me.id)
        return pick(['start', 'settings', 'home', 'verdict'], 'home');
      return pick(['setup', 'start', 'settings', 'home', 'verdict'], 'setup');
    case 'invited':
    case 'signing':
      // Signed: Your challenges says who it waits for; before the partner joins, the invite link.
      // The pact stays open to read (Set up's Read the pact goes there).
      if (built.iSigned)
        return pick(
          ['setup', 'pact', 'practice', 'settings', 'home', 'verdict', 'start'],
          c.status === 'signing' ? 'home' : 'waiting',
        );
      return pick(
        ['pact', 'practice', 'setup', 'settings', 'home', 'verdict', 'start'],
        'pact',
      );
    case 'running':
      return pick(RUNNING, 'overview');
    case 'finished':
      return pick(RUNNING, 'verdict');
  }
}

export function LiveApp() {
  const [loaded, setLoaded] = useState<Loaded>({ kind: 'loading' });
  // Read before the first load: nothing depends on it until the account's rows are in.
  const [wantedChallenge, setWanted] = useState<string | null>(() =>
    readStored(OPEN_KEY),
  );
  const setWantedChallenge = useCallback((id: string | null) => {
    writeStored(OPEN_KEY, id);
    setWanted(id);
  }, []);
  /** Changes on screen whose writes aren't in the loaded rows yet, oldest first (see `Pending`). */
  const [pending, setPending] = useState<Pending[]>([]);
  /** The clock: set when rows land and every minute between, so a tab left open keeps up. */
  const [now, setNow] = useState(nowIso);
  // Overview is the usual first page: its code is fetched with the data, not after it.
  useEffect(() => {
    void pageById('overview')
      .components[0].preload()
      .catch(() => {});
  }, []);
  /** The last load failed (offline, or the database didn't answer); it tries again by itself. */
  const [failed, setFailed] = useState(false);
  /** The invite link opened had expired or was already used. Any navigation leaves it. */
  const [inviteGone, setInviteGone] = useState(false);
  /** Signed in from a reset link and still choosing the new password. */
  const [resetChoosing, setResetting] = useState(true);
  const query = useSyncExternalStore(subscribeUrl, search, noSearch);
  const p = new URLSearchParams(query).get('page');
  const page: PageId | null = isPageId(p) ? p : null;

  /** Loads everything again: the session, the invite or shared link opened, and the account's rows. */
  const reload = useCallback(async () => {
    // Only the newest load lands: one started earlier but answered later would put old rows back.
    const mine = ++loads;
    /** Keeps what is on screen, shows the failed state if nothing is, and tries again soon. */
    const fail = () => {
      if (mine !== loads) return;
      setFailed(true);
      setTimeout(() => window.dispatchEvent(new Event(RETRY_EVENT)), 4000);
    };
    // An invite link: null when it expired or was used, and it's forgotten; an error is a failed
    // load, and the link is kept for the next one.
    const invite = inviteToken;
    let preview: InvitePreviewRow | null = null;
    /** The invite link that just turned out expired or used. */
    let gone: string | null = null;
    if (invite) {
      try {
        preview = (await api.invitePreview(invite)) as InvitePreviewRow | null;
      } catch {
        return fail();
      }
      if (preview)
        lastInvite = { token: invite, challenge: preview.challenge.id };
      // Not while it's being accepted here: that uses it up, and the pact opens instead.
      else if (invite === inviteToken && !joining) {
        gone = invite;
        inviteToken = acceptAfter = null;
        writeStored(INVITE_KEY, null);
        writeStored(ACCEPT_KEY, null);
      }
    }
    // A shared link: null once it was turned off (forget it). An error keeps the link, and the
    // challenge it showed last.
    const share = sharedToken;
    let shared: SharedRow | null = null;
    if (share) {
      try {
        shared = await api.sharedPreview(share);
        if (!shared && share === sharedToken) {
          sharedToken = null;
          writeStored(SHARED_KEY, null);
        }
      } catch {
        shared = lastShared?.token === share ? lastShared.row : null;
      }
      if (shared) lastShared = { token: share, row: shared };
    }
    await api.ensureProfile().catch(() => {});
    // null: signed out (or no profile yet). A failed load keeps what is on screen until the next one.
    const rows = await api.loadRows().catch(() => undefined);
    // Say the invite link is spent, unless this account is in its challenge now (accepted in another
    // tab, or on another device): then it's just forgotten.
    if (
      gone &&
      !(
        rows &&
        lastInvite?.token === gone &&
        rows.challenges.some((c) => c.id === lastInvite?.challenge)
      )
    )
      setInviteGone(true);
    if (mine !== loads) return;
    if (rows === undefined) return fail();
    const urls = rows ? await api.proofUrls(rows).catch(() => ({})) : {};
    if (mine !== loads) return;
    // The load lands in one render: the rows, a fresh clock, and the pending changes these rows
    // already have taken off (the rest stay on top of them).
    setFailed(false);
    setNow(nowIso());
    setPending((list) => withoutSaved(list, mine));
    setLoaded(
      rows
        ? { kind: 'in', rows, urls, preview, shared, at: Date.now() }
        : { kind: 'out', preview, shared },
    );
  }, []);

  // The page, an invite and a shared link come from the URL: /app?page=log, ?invite=…, ?shared=….
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const invite = params.get('invite'),
      shared = params.get('shared');
    if (params.has('reset')) resetOpened = true;
    if (invite) writeStored(INVITE_KEY, invite);
    if (shared) writeStored(SHARED_KEY, shared);
    inviteToken = invite ?? readStored(INVITE_KEY);
    sharedToken = shared ?? readStored(SHARED_KEY);
    // reload() sets state only after the database answers, never during the effect.
    // oxlint-disable-next-line react/react-compiler
    void reload();
    const auth = api.onAuthChange(() => void reload());
    // One write changes several rows, and each arrives on its own: reload once, a moment after the
    // last. While a change of ours is on its way, skip it: that send reloads when it's done, and
    // that load has this change too.
    let soon: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = api.subscribe(() => {
      clearTimeout(soon);
      soon = setTimeout(() => {
        if (sending === 0) void reload();
      }, 300);
    });
    const onFocus = () => {
      if (document.visibilityState === 'visible') void reload();
    };
    document.addEventListener('visibilitychange', onFocus);
    const again = () => void reload();
    window.addEventListener(RETRY_EVENT, again);
    window.addEventListener('online', again);
    // The clock moves on without reloading, so today, what's open and the deadlines stay right.
    const tick = setInterval(() => setNow(nowIso()), 60e3);
    return () => {
      clearTimeout(soon);
      clearInterval(tick);
      window.removeEventListener(RETRY_EVENT, again);
      window.removeEventListener('online', again);
      auth.unsubscribe();
      unsubscribe();
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [reload]);

  const built = useMemo(
    () =>
      loaded.kind === 'in'
        ? buildWorld(
            loaded.rows,
            now,
            deviceZone(),
            { origin: location.origin },
            loaded.urls,
            wantedChallenge,
          )
        : null,
    [loaded, wantedChallenge, now],
  );

  /** The world as the database has it. */
  const saved: World | null = useMemo(() => {
    if (loaded.kind === 'loading') return null;
    if (
      loaded.preview &&
      (loaded.kind === 'out' ||
        !loaded.rows.challenges.some(
          (c) => c.id === loaded.preview?.challenge.id,
        ))
    )
      return inviteWorld(
        loaded.preview,
        loaded.kind === 'in' ? loaded.rows.me : null,
        now,
      );
    const links = { origin: location.origin };
    // Signed out, Landing and Sign up only show the themes, and Shared its one challenge.
    if (loaded.kind === 'out')
      return loaded.shared
        ? withShared(
            { ...signedOutWorld, saved: [], past: [] },
            loaded.shared,
            links,
          )
        : signedOutWorld;
    if (!built) return null;
    return loaded.shared
      ? withShared(built.world, loaded.shared, links)
      : built.world;
  }, [loaded, built, now]);

  /** What's on screen: that world with the changes still on their way applied, in order. */
  const world = useMemo(
    () => saved && pending.reduce((w, p) => p.change(w), saved),
    [saved, pending],
  );

  // When the oldest open day locks, reload: it shows as closed, and the load runs the deadlines, so
  // what wasn't logged is marked. Worked out from when the rows landed, so the minute tick never
  // moves it; a few seconds late, so the database's clock has passed it too.
  const lockAt =
    loaded.kind === 'in' && built?.current?.status === 'running'
      ? nextLock(built.world.challenge, loaded.at)
      : null;
  useEffect(() => {
    if (lockAt === null) return;
    const wait = Math.max(lockAt - Date.now(), 0) + 5e3;
    // Past setTimeout's limit (24 days): a later load schedules it.
    if (wait > 2 ** 31 - 1) return;
    const timer = setTimeout(() => void reload(), wait);
    return () => clearTimeout(timer);
  }, [lockAt, reload]);

  const resetting = resetChoosing && resetOpened && loaded.kind === 'in';
  const shown = resolve(
    page,
    loaded,
    built,
    new URLSearchParams(query).has('shared'),
  );
  /** Signed in, on an invite to a challenge this account isn't in yet. */
  const inviteOpen =
    loaded.kind === 'in' &&
    !!loaded.preview &&
    !loaded.rows.challenges.some((c) => c.id === loaded.preview?.challenge.id);

  // The browser tab names the page, so history and the tab switcher can tell pages apart.
  useEffect(() => {
    const name =
      shown === 'waiting' || shown === 'landing'
        ? null
        : (TAB_TITLES[shown] ?? pageById(shown).title);
    document.title = name ? `${name} · The Challenge` : 'The Challenge';
  }, [shown]);

  const navigate = useCallback<Nav['navigate']>((next) => {
    const url = new URL(location.href);
    url.searchParams.delete('invite');
    url.searchParams.delete('shared');
    url.searchParams.delete('reset');
    if (next) url.searchParams.set('page', next);
    else url.searchParams.delete('page');
    history.pushState(null, '', url);
    window.dispatchEvent(new Event(URL_EVENT));
    window.scrollTo({ top: 0 });
    setInviteGone(false);
  }, []);

  const nav = useMemo<Nav>(
    () => ({
      page: shown === 'waiting' ? null : shown,
      version: 1,
      navigate,
    }),
    [shown, navigate],
  );

  if (!world)
    return (
      <NxRoot>
        <div className="nx-frame" aria-busy={!failed}>
          {failed && (
            <CantLoad onRetry={() => void reload()}>
              Check that you’re online. It tries again every few seconds too.
            </CantLoad>
          )}
        </div>
      </NxRoot>
    );

  return (
    <NxRoot look={world.challenge.look}>
      <NavContext.Provider value={nav}>
        <Hosting
          world={world}
          built={built}
          inviteOpen={inviteOpen}
          reload={reload}
          navigate={navigate}
          setPending={setPending}
          setWantedChallenge={setWantedChallenge}
        >
          {(host) => (
            <HostedWorld world={world}>
              {resetting ? (
                <NewPassword
                  onDone={() => {
                    resetOpened = false;
                    setResetting(false);
                    navigate(null);
                  }}
                />
              ) : inviteGone ? (
                <InviteGone signedIn={loaded.kind === 'in'} />
              ) : shown === 'waiting' ? (
                <Waiting world={world} host={host} />
              ) : (
                <ShownPage id={shown} />
              )}
            </HostedWorld>
          )}
        </Hosting>
      </NavContext.Provider>
    </NxRoot>
  );
}

/**
 * The page on screen. Moving to a page whose code hasn't arrived keeps the page before it up until it
 * has (never a blank frame); the first page waits on its own, with a spinner if it's slow. A page
 * that throws, or whose code can't be fetched, shows the Can't load card.
 */
function ShownPage({ id }: { id: PageId }) {
  const Version = pageById(id).components[0];
  /** The last page whose code had arrived (or that failed to arrive, for its card to say so). */
  const [held, setHeld] = useState(id);
  useEffect(() => {
    let on = true;
    const show = () => on && setHeld(id);
    Version.preload().then(show, show);
    return () => {
      on = false;
    };
  }, [Version, id]);
  // The first page loads alone; a moment after it's up, the rest are fetched so moving on never waits.
  useEffect(() => {
    const later = setTimeout(preloadPages, 1500);
    return () => clearTimeout(later);
  }, []);
  const page = Version.ready() ? id : held;
  const Shown = pageById(page).components[0];
  return (
    <PageBoundary key={page}>
      <Shown />
    </PageBoundary>
  );
}

/** The invite link made for the partner, as kept in this browser (LINK_KEY). */
type StoredLink = {
  challenge: string;
  link: string;
  code: string;
  /** Epoch ms after which a new link is made (links last 7 days). */
  renewAt?: number;
};

/** The host every page reaches through useBackend(). Inside NxRoot so it can show toasts. */
function Hosting({
  world,
  built,
  inviteOpen,
  reload,
  navigate,
  setPending,
  setWantedChallenge,
  children,
}: {
  world: World;
  built: Built | null;
  inviteOpen: boolean;
  reload: () => Promise<void>;
  navigate: Nav['navigate'];
  setPending: (f: (list: Pending[]) => Pending[]) => void;
  setWantedChallenge: (id: string | null) => void;
  children: (host: Host) => ReactNode;
}) {
  const toast = useToast();
  // The latest values, so the host's functions stay the same object between renders.
  const latest = useRef({ world, built });
  useLayoutEffect(() => {
    latest.current = { world, built };
  }, [world, built]);

  const host = useMemo<Host>(() => {
    /** The one pop-up the app keeps: a write that failed, so it never fails silently. */
    const fail = (e: unknown) => toast(failure(e));
    /**
     * Runs `f`; on failure says so, reloads, and returns false. `quiet`: the page shows the failure
     * itself, so there's no pop-up and no reload.
     */
    async function attempt<T>(
      f: () => Promise<T>,
      quiet = false,
    ): Promise<T | false> {
      try {
        return await f();
      } catch (e) {
        if (quiet) return false;
        fail(e);
        await reload();
        return false;
      }
    }
    /**
     * Starting, joining or ending a challenge: a second tap while the first is still on its way
     * returns false at once, instead of making a second challenge (nx_create_challenge has no lock
     * against two calls from one account) or failing on the first one's leftovers.
     */
    async function once(f: () => Promise<boolean>) {
      if (joining) return false;
      joining = true;
      try {
        return await f();
      } finally {
        joining = false;
      }
    }
    const ids = () => {
      const { world: w } = latest.current;
      return {
        challenge: w.challenge.id,
        me: w.me.id,
        partner:
          w.partner.id === PENDING_PARTNER ? PENDING_PARTNER : w.partner.id,
      };
    };
    /** After signing in: load the account, and go back to the page that asked for an account. */
    async function signedIn() {
      await reload();
      const to = afterSignIn;
      afterSignIn = null;
      if (to) navigate(to);
    }
    /** The partner's invite link: the one kept in this browser while it has days left, else a new one. */
    async function makeLink() {
      const { world: w } = latest.current;
      let kept: StoredLink | null = null;
      try {
        kept = JSON.parse(readStored(LINK_KEY) ?? 'null') as StoredLink | null;
      } catch {
        // Unreadable: make a new one.
      }
      if (
        kept?.challenge === w.challenge.id &&
        Date.now() < (kept.renewAt ?? 0)
      )
        return kept;
      const name = w.partner.id === PENDING_PARTNER ? '' : w.partner.name;
      // Quiet: the invite screen says it couldn't make the link, with Try again.
      const made = await attempt(
        () => api.createInvite(w.challenge.id, name),
        true,
      );
      if (made === false) return null;
      const out: StoredLink = {
        challenge: w.challenge.id,
        link: `${location.origin}/app?invite=${made.token}`,
        code: made.code,
        // A day before the link expires, so a link shown here always has time left.
        renewAt: Date.now() + 6 * 864e5,
      };
      writeStored(LINK_KEY, JSON.stringify(out));
      return out;
    }
    /** The link being made: a second ask meanwhile waits for the same one, never a second invite. */
    let making: Promise<StoredLink | null> | null = null;

    return {
      send: async (commands) => {
        // The change already on screen for these commands: act() applies it just before sending.
        const mine = unclaimed;
        unclaimed = [];
        const { challenge } = ids();
        sending += 1;
        let ok = true;
        try {
          for (const c of commands) await api.send(challenge, c);
        } catch (e) {
          ok = false;
          fail(e);
        }
        // Saved: it stays on screen until a load that begins after this moment lands, since that
        // load has it. Failed: it comes off the screen at once.
        const at = loads;
        setPending((list) =>
          ok
            ? list.map((p) => (mine.includes(p.id) ? { ...p, savedAt: at } : p))
            : list.filter((p) => !mine.includes(p.id)),
        );
        sending -= 1;
        // Several quick saves reload once, after the last: that load has every one of them.
        if (sending === 0) await reload();
        return ok;
      },
      // Always settles: the proof, or null when the person cancels or the upload fails.
      pickProof: (day: DateString) =>
        new Promise<Proof | null>((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/jpeg,image/png,image/webp';
          // In the page while picking (some browsers send its events only then), out of sight.
          input.style.cssText =
            'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none';
          let settled = false;
          const done = (proof: Proof | null) => {
            if (settled) return;
            settled = true;
            input.remove();
            resolve(proof);
          };
          input.addEventListener('cancel', () => done(null));
          input.addEventListener('change', async () => {
            const file = input.files?.[0];
            if (!file) return done(null);
            const { challenge, me } = ids();
            const up = await attempt(() =>
              api.uploadProof(challenge, me, file),
            );
            if (up === false) return done(null);
            done({
              id: up.path,
              src: URL.createObjectURL(up.blob),
              alt: `Screenshot for ${formatDay(day)}`,
              ...(up.takenAt ? { takenAt: up.takenAt } : {}),
            });
          });
          document.body.appendChild(input);
          input.click();
        }),
      signUp: async (a) => {
        const r = await attempt(() =>
          api.signUp(a, { invite: inviteToken, shared: sharedToken }),
        );
        if (r === 'in') await signedIn();
        return r;
      },
      signIn: async (a) => {
        const ok = await attempt(() => api.signIn(a));
        if (ok !== false) await signedIn();
        return ok !== false;
      },
      sendLink: async (a) =>
        (await attempt(() =>
          api.sendLink(a, { invite: inviteToken, shared: sharedToken }),
        )) !== false,
      verifyCode: async (a) => {
        const ok = await attempt(() => api.verifyCode(a));
        if (ok !== false) await signedIn();
        return ok !== false;
      },
      sendReset: async (email) =>
        (await attempt(() => api.sendReset(email))) !== false,
      resetPassword: async (a) => {
        const ok = await attempt(() => api.resetPassword(a));
        if (ok === false) return false;
        await signedIn();
        return true;
      },
      signOut: async () => {
        await api.signOut();
        for (const key of [INVITE_KEY, SHARED_KEY, LINK_KEY, ACCEPT_KEY])
          writeStored(key, null);
        inviteToken = sharedToken = afterSignIn = acceptAfter = null;
        lastShared = lastInvite = null;
        await reload();
        navigate('landing');
      },
      openChallenge: (id: string, page?: PageId) => {
        setWantedChallenge(id);
        navigate(page ?? null);
      },
      startFrom: (template: Template, couple?: string) =>
        once(async () => {
          const { world: w, built: b } = latest.current;
          // Who with: the one chosen on Start; a challenge run again keeps its own couple.
          const shown = b?.current?.couple_id;
          const withWho =
            couple ??
            (template.kind === 'again' ? template.challenge.coupleId : shown);
          // Starting from scratch again opens the draft as it was left. A template always starts its
          // own challenge: it never replaces one being set up.
          const same = withWho === 'new' ? !b?.hasPartner : withWho === shown;
          if (
            template.kind === 'blank' &&
            same &&
            b?.current?.status === 'draft'
          ) {
            navigate('setup');
            return true;
          }
          const id = await attempt(() =>
            api.startChallenge(
              template,
              shift(w.today, 1),
              deviceZone(),
              w.me.id,
              null,
              withWho,
            ),
          );
          if (id === false) return false;
          setWantedChallenge(id);
          await reload();
          navigate('setup');
          return true;
        }),
      saveDraft: async (draft: SetupDraft) => {
        const { challenge, me } = ids();
        const { world: w } = latest.current;
        if (w.challenge.status !== 'draft') return false;
        const ok = await attempt(() =>
          api.saveSetup(challenge, draft, me, w.challenge),
        );
        if (ok === false) return false;
        await reload();
        return true;
      },
      finishSetup: (draft: SetupDraft) =>
        once(async () => {
          const { challenge, me } = ids();
          const { world: w } = latest.current;
          const ok = await attempt(() =>
            api.finishSetup(
              challenge,
              draft,
              me,
              w.challenge.id === challenge ? w.challenge : null,
            ),
          );
          if (ok === false) return false;
          await reload();
          // The pact, to read and sign; already signed (nothing in the terms changed), it shows that.
          navigate('pact');
          return true;
        }),
      cancelChallenge: () =>
        once(async () => {
          const { challenge } = ids();
          const done = await attempt(() => api.cancelChallenge(challenge));
          if (done === false) return false;
          writeStored(LINK_KEY, null);
          setWantedChallenge(null);
          await reload();
          if (done === 'ended') showVerdictFor(challenge);
          navigate(done === 'ended' ? 'verdict' : null);
          return true;
        }),
      inviteLink: () =>
        (making ??= makeLink().finally(() => {
          making = null;
        })),
      startShared: (couple?: string) =>
        once(async () => {
          const { world: w } = latest.current;
          const shared = w.saved.find((x) => x.source === 'link');
          if (!shared) return false;
          if (!latest.current.built) {
            // Not signed in yet: make the account first; the link waits in this browser.
            afterSignIn = 'shared';
            setSignupMode('signup');
            navigate('signup');
            return false;
          }
          const id = await attempt(() =>
            api.startChallenge(
              { kind: 'saved', saved: shared },
              shift(w.today, 1),
              deviceZone(),
              w.me.id,
              null,
              couple,
            ),
          );
          if (id === false) return false;
          sharedToken = null;
          writeStored(SHARED_KEY, null);
          setWantedChallenge(id);
          await reload();
          navigate('setup');
          return true;
        }),
      saveShared: () =>
        once(async () => {
          const t = sharedToken;
          if (!t) return false;
          if (!latest.current.built) {
            afterSignIn = 'shared';
            setSignupMode('signup');
            navigate('signup');
            return false;
          }
          const ok = await attempt(() => api.saveShared(t));
          if (ok === false) return false;
          // Saved: the link has done its job, and Your challenges lists the copy.
          sharedToken = null;
          writeStored(SHARED_KEY, null);
          await reload();
          return true;
        }),
      dismissInvite: () => {
        inviteToken = acceptAfter = lastInvite = null;
        writeStored(INVITE_KEY, null);
        writeStored(ACCEPT_KEY, null);
        void reload().then(() => navigate(null));
      },
      acceptInvite: () =>
        once(async () => {
          const t = inviteToken;
          if (!t) return false;
          const { world: w } = latest.current;
          if (w.me.id === 'invitee') {
            // Not signed in yet: make the account first. The invite waits in this browser, and is
            // accepted as soon as they're signed in (the effect below), even from the email's tab.
            acceptAfter = writeStored(ACCEPT_KEY, t) ? null : t;
            setSignupMode('signup');
            navigate('signup');
            return false;
          }
          const id = await attempt(() => api.acceptInvite(t));
          if (id === false) return false;
          writeStored(INVITE_KEY, null);
          writeStored(ACCEPT_KEY, null);
          inviteToken = acceptAfter = null;
          setWantedChallenge(id);
          await reload();
          navigate('pact');
          return true;
        }),
    };
  }, [toast, reload, navigate, setPending, setWantedChallenge]);

  // Accept was tapped before having an account: now that they're signed in on the invite, accept it
  // for them, once, so they land on the pact instead of tapping Accept again.
  useEffect(() => {
    const t = inviteToken;
    if (!inviteOpen || !t) return;
    if (acceptAfter !== t && readStored(ACCEPT_KEY) !== t) return;
    acceptAfter = null;
    writeStored(ACCEPT_KEY, null);
    void host.acceptInvite();
  }, [inviteOpen, host]);

  const ctx = useMemo(
    () => ({
      host,
      // Shows the change at once and keeps it on screen until its send settles (see `Pending`).
      apply: (change: (w: World) => World) => {
        const id = ++changes;
        unclaimed.push(id);
        setPending((list) => [...list, { id, change }]);
      },
    }),
    [host, setPending],
  );
  return (
    <HostContext.Provider value={ctx}>
      {/* The host reads `latest` only when a page calls it, never while rendering. */}
      {/* oxlint-disable-next-line react/react-compiler */}
      {children(host)}
    </HostContext.Provider>
  );
}
