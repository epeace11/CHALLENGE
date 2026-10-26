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
import type { DateString, World } from '@/lib/next/model';
import { shift } from '@/lib/next/calendar';
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
import { pageById } from '@/components/next/pages/registry';
import { setSignupMode } from '@/components/next/pages/signup/mode';
import { showVerdictFor } from '@/components/next/pages/verdict/which';
import { WifiOff } from 'lucide-react';
import {
  Button,
  EmptyState,
  GlassCard,
  NxRoot,
  useToast,
} from '@/components/next/ui';
import { HostedWorld } from '@/components/next/world';
import { world as signedOutWorld } from '@/lib/next/demo';
import * as api from '@/lib/live/api';
import {
  PENDING_PARTNER,
  buildWorld,
  inviteWorld,
  withShared,
  type Built,
  type InvitePreviewRow,
  type ProofUrls,
  type Rows,
  type SharedRow,
} from '@/lib/live/world';
import { NewPassword } from './new-password';
import { Waiting } from './waiting';

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

/** The invite token from the link (?invite=…), kept while its person signs up. */
let inviteToken: string | null = null;
/** A shared challenge's token from its link (?shared=…), kept the same way. */
let sharedToken: string | null = null;
/** Counts loads, so only the newest one's rows land on screen. */
let loads = 0;
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
const writeStored = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private mode: links then live only in the URL.
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
    };

const SIGNED_OUT: PageId[] = ['landing', 'signup'];
const RUNNING: PageId[] = [
  'overview',
  'log',
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
  if (!c) return pick(['start', 'settings'], 'start');
  switch (c.status) {
    // Your challenges (and a past verdict from it) stay open while the next one is set up.
    case 'draft':
      return pick(['setup', 'start', 'settings', 'home', 'verdict'], 'setup');
    case 'invited':
    case 'signing':
      if (built.iSigned)
        return pick(
          ['setup', 'practice', 'settings', 'home', 'verdict'],
          'waiting',
        );
      return pick(
        ['pact', 'practice', 'setup', 'settings', 'home', 'verdict'],
        'pact',
      );
    case 'running':
      return pick(RUNNING, 'overview');
    case 'finished':
      return pick([...RUNNING, 'start'], 'verdict');
  }
}

export function LiveApp() {
  const [loaded, setLoaded] = useState<Loaded>({ kind: 'loading' });
  const [wantedChallenge, setWantedChallenge] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<World | null>(null);
  /** The last load failed (offline, or the database didn't answer); it tries again by itself. */
  const [failed, setFailed] = useState(false);
  /** Signed in from a reset link and still choosing the new password. */
  const [resetChoosing, setResetting] = useState(true);
  const query = useSyncExternalStore(subscribeUrl, search, noSearch);
  const p = new URLSearchParams(query).get('page');
  const page: PageId | null = isPageId(p) ? p : null;

  /** Loads everything again: the session, the invite or shared link opened, and the account's rows. */
  const reload = useCallback(async () => {
    // Only the newest load lands: one started earlier but answered later would put old rows back.
    const mine = ++loads;
    const preview = inviteToken
      ? ((await api
          .invitePreview(inviteToken)
          .catch(() => null)) as InvitePreviewRow | null)
      : null;
    const shared = sharedToken
      ? await api.sharedPreview(sharedToken).catch(() => null)
      : null;
    // A link that was turned off is forgotten.
    if (sharedToken && !shared) {
      sharedToken = null;
      writeStored(SHARED_KEY, null);
    }
    await api.ensureProfile().catch(() => {});
    // null: signed out (or no profile yet). A failed load keeps what is on screen until the next one.
    const rows = await api.loadRows().catch(() => undefined);
    if (mine !== loads) return;
    if (rows === undefined) {
      setFailed(true);
      setTimeout(() => window.dispatchEvent(new Event(RETRY_EVENT)), 4000);
      return;
    }
    setFailed(false);
    if (!rows) return setLoaded({ kind: 'out', preview, shared });
    const urls = await api.proofUrls(rows).catch(() => ({}));
    if (mine !== loads) return;
    setOverlay(null);
    setLoaded({ kind: 'in', rows, urls, preview, shared });
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
    const unsubscribe = api.subscribe(() => void reload());
    const onFocus = () => {
      if (document.visibilityState === 'visible') void reload();
    };
    document.addEventListener('visibilitychange', onFocus);
    const again = () => void reload();
    window.addEventListener(RETRY_EVENT, again);
    window.addEventListener('online', again);
    return () => {
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
            nowIso(),
            deviceZone(),
            { origin: location.origin },
            loaded.urls,
            wantedChallenge,
          )
        : null,
    [loaded, wantedChallenge],
  );

  const world: World | null = useMemo(() => {
    if (overlay) return overlay;
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
        nowIso(),
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
  }, [overlay, loaded, built]);

  const resetting = resetChoosing && resetOpened && loaded.kind === 'in';
  const shown = resolve(
    page,
    loaded,
    built,
    new URLSearchParams(query).has('shared'),
  );

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
            <main className="nx-main flex min-h-dvh flex-col justify-center">
              <GlassCard pad="lg" role="alert">
                <EmptyState
                  icon={WifiOff}
                  title="Can’t load The Challenge"
                  action={
                    <Button variant="primary" onClick={() => void reload()}>
                      Try again
                    </Button>
                  }
                >
                  Check that you’re online. It tries again every few seconds
                  too.
                </EmptyState>
              </GlassCard>
            </main>
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
          reload={reload}
          navigate={navigate}
          setOverlay={setOverlay}
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
              ) : shown === 'waiting' ? (
                <Waiting world={world} host={host} />
              ) : (
                <Page id={shown} />
              )}
            </HostedWorld>
          )}
        </Hosting>
      </NavContext.Provider>
    </NxRoot>
  );
}

function Page({ id }: { id: PageId }) {
  const Version = pageById(id).components[0];
  return <Version key={id} />;
}

/** The host every page reaches through useBackend(). Inside NxRoot so it can show toasts. */
function Hosting({
  world,
  built,
  reload,
  navigate,
  setOverlay,
  setWantedChallenge,
  children,
}: {
  world: World;
  built: Built | null;
  reload: () => Promise<void>;
  navigate: Nav['navigate'];
  setOverlay: (w: World | null | ((w: World | null) => World | null)) => void;
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
    /** Runs `f`; on failure shows the database's message, reloads, and returns false. */
    async function attempt<T>(f: () => Promise<T>): Promise<T | false> {
      try {
        return await f();
      } catch (e) {
        toast(
          e instanceof Error ? e.message : 'Something went wrong. Try again.',
        );
        await reload();
        return false;
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
    return {
      send: async (commands) => {
        const challenge = ids().challenge;
        const ok = await attempt(async () => {
          for (const c of commands) await api.send(challenge, c);
        });
        if (ok !== false) await reload();
        return ok !== false;
      },
      pickProof: (day: DateString) =>
        new Promise((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/jpeg,image/png,image/webp';
          input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return resolve(null);
            const { challenge, me } = ids();
            const up = await attempt(() =>
              api.uploadProof(challenge, me, file),
            );
            if (up === false) return resolve(null);
            resolve({
              id: up.path,
              src: URL.createObjectURL(up.blob),
              alt: `Screenshot for ${day}`,
              ...(up.takenAt ? { takenAt: up.takenAt } : {}),
            });
          };
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
        toast('Password saved');
        await signedIn();
        return true;
      },
      signOut: async () => {
        await api.signOut();
        for (const key of [INVITE_KEY, SHARED_KEY, LINK_KEY])
          writeStored(key, null);
        inviteToken = sharedToken = afterSignIn = null;
        await reload();
        navigate('landing');
      },
      startFrom: async (template: Template) => {
        const { world: w, built: b } = latest.current;
        const draft = b?.current?.status === 'draft' ? b.current.id : null;
        const id = await attempt(() =>
          api.startChallenge(
            template,
            shift(w.today, 1),
            deviceZone(),
            w.me.id,
            w.partner.id,
            draft,
          ),
        );
        if (id === false) return false;
        setWantedChallenge(id);
        await reload();
        navigate('setup');
        return true;
      },
      finishSetup: async (draft: SetupDraft) => {
        const { challenge, me, partner } = ids();
        const { world: w } = latest.current;
        const ok = await attempt(() =>
          api.finishSetup(
            challenge,
            draft,
            me,
            partner,
            w.challenge.id === challenge ? w.challenge : null,
          ),
        );
        if (ok === false) return false;
        await reload();
        navigate(null);
        return true;
      },
      cancelChallenge: async () => {
        const { challenge } = ids();
        const done = await attempt(() => api.cancelChallenge(challenge));
        if (done === false) return false;
        writeStored(LINK_KEY, null);
        setWantedChallenge(null);
        await reload();
        toast(done === 'ended' ? 'Challenge ended' : 'Challenge cancelled');
        if (done === 'ended') showVerdictFor(challenge);
        navigate(done === 'ended' ? 'verdict' : null);
        return true;
      },
      inviteLink: async () => {
        const { world: w } = latest.current;
        const kept = readStored(LINK_KEY);
        if (kept) {
          const saved = JSON.parse(kept) as {
            challenge: string;
            link: string;
            code: string;
            /** Epoch ms after which a new link is made (links last 7 days). */
            renewAt?: number;
          };
          if (
            saved.challenge === w.challenge.id &&
            Date.now() < (saved.renewAt ?? 0)
          )
            return saved;
        }
        const name = w.partner.id === PENDING_PARTNER ? '' : w.partner.name;
        const made = await attempt(() =>
          api.createInvite(w.challenge.id, name),
        );
        if (made === false) return null;
        const out = {
          challenge: w.challenge.id,
          link: `${location.origin}/app?invite=${made.token}`,
          code: made.code,
          // A day before the link expires, so a link shown here always has time left.
          renewAt: Date.now() + 6 * 864e5,
        };
        writeStored(LINK_KEY, JSON.stringify(out));
        return out;
      },
      startShared: async () => {
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
            w.partner.id,
            latest.current.built?.current?.status === 'draft'
              ? latest.current.built.current.id
              : null,
          ),
        );
        if (id === false) return false;
        sharedToken = null;
        writeStored(SHARED_KEY, null);
        setWantedChallenge(id);
        await reload();
        navigate('setup');
        return true;
      },
      saveShared: async () => {
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
      },
      acceptInvite: async () => {
        const t = inviteToken;
        if (!t) return false;
        const { world: w } = latest.current;
        if (w.me.id === 'invitee') {
          // Not signed in yet: make the account first; the invite waits in this tab.
          setSignupMode('signup');
          navigate('signup');
          return false;
        }
        const id = await attempt(() => api.acceptInvite(t));
        if (id === false) return false;
        writeStored(INVITE_KEY, null);
        inviteToken = null;
        setWantedChallenge(id);
        await reload();
        navigate('pact');
        return true;
      },
    };
  }, [toast, reload, navigate, setWantedChallenge]);

  const ctx = useMemo(
    () => ({
      host,
      apply: (change: (w: World) => World) =>
        setOverlay((w) => change(w ?? world)),
    }),
    [host, setOverlay, world],
  );
  return (
    <HostContext.Provider value={ctx}>
      {/* The host reads `latest` only when a page calls it, never while rendering. */}
      {/* oxlint-disable-next-line react/react-compiler */}
      {children(host)}
    </HostContext.Provider>
  );
}
