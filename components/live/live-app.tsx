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
import { NxRoot, useToast } from '@/components/next/ui';
import { HostedWorld } from '@/components/next/world';
import { world as signedOutWorld } from '@/lib/next/demo';
import * as api from '@/lib/live/api';
import {
  PENDING_PARTNER,
  buildWorld,
  inviteWorld,
  type Built,
  type InvitePreviewRow,
  type ProofUrls,
  type Rows,
} from '@/lib/live/world';
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
const LINK_KEY = 'nx-invite-link';

/** The invite token from the link (?invite=…), kept for this tab while its person signs up. */
let inviteToken: string | null = null;

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

/** The invite outlives the tab (localStorage); the invite link made for a partner only this tab (sessionStorage). */
const store = (key: string) =>
  key === INVITE_KEY ? localStorage : sessionStorage;
const readSession = (key: string) => {
  try {
    return store(key).getItem(key);
  } catch {
    return null;
  }
};
const writeSession = (key: string, value: string | null) => {
  try {
    if (value === null) store(key).removeItem(key);
    else store(key).setItem(key, value);
  } catch {
    // Private mode: the invite then lives only in the URL.
  }
};

type Loaded =
  | { kind: 'loading' }
  | { kind: 'out'; preview: InvitePreviewRow | null }
  | {
      kind: 'in';
      rows: Rows;
      urls: ProofUrls;
      preview: InvitePreviewRow | null;
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
  'start',
  'practice',
];

/** The page to show for `wanted`, given where the account stands. */
function resolve(
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
    case 'draft':
      return pick(['setup', 'start', 'settings'], 'setup');
    case 'invited':
    case 'signing':
      if (built.iSigned)
        return pick(['setup', 'practice', 'settings'], 'waiting');
      return pick(['pact', 'practice', 'setup', 'settings'], 'pact');
    case 'running':
      return pick(RUNNING, 'overview');
    case 'finished':
      return pick([...RUNNING, 'verdict'], 'verdict');
  }
}

export function LiveApp() {
  const [loaded, setLoaded] = useState<Loaded>({ kind: 'loading' });
  const [wantedChallenge, setWantedChallenge] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<World | null>(null);
  const query = useSyncExternalStore(subscribeUrl, search, noSearch);
  const p = new URLSearchParams(query).get('page');
  const page: PageId | null = isPageId(p) ? p : null;

  /** Loads everything again: the session, the invite on the link, and the account's rows. */
  const reload = useCallback(async () => {
    const preview = inviteToken
      ? ((await api
          .invitePreview(inviteToken)
          .catch(() => null)) as InvitePreviewRow | null)
      : null;
    await api.ensureProfile().catch(() => {});
    const rows = await api.loadRows().catch(() => null);
    if (!rows) return setLoaded({ kind: 'out', preview });
    const urls = await api.proofUrls(rows).catch(() => ({}));
    setOverlay(null);
    setLoaded({ kind: 'in', rows, urls, preview });
  }, []);

  // The page and invite come from the URL: /app?page=log, /app?invite=<token>.
  useEffect(() => {
    const invite = new URLSearchParams(location.search).get('invite');
    if (invite) writeSession(INVITE_KEY, invite);
    inviteToken = invite ?? readSession(INVITE_KEY);
    // reload() sets state only after the database answers, never during the effect.
    // oxlint-disable-next-line react/react-compiler
    void reload();
    const auth = api.onAuthChange(() => void reload());
    const unsubscribe = api.subscribe(() => void reload());
    const onFocus = () => {
      if (document.visibilityState === 'visible') void reload();
    };
    document.addEventListener('visibilitychange', onFocus);
    return () => {
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
    // Signed out, Landing and Sign up only show the themes.
    if (loaded.kind === 'out') return signedOutWorld;
    return built?.world ?? null;
  }, [overlay, loaded, built]);

  const shown = resolve(page, loaded, built);

  const navigate = useCallback<Nav['navigate']>((next) => {
    const url = new URL(location.href);
    url.searchParams.delete('invite');
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
        <div className="nx-frame" aria-busy="true" />
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
              {shown === 'waiting' ? (
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
    return {
      send: async (command) => {
        const ok = await attempt(() => api.send(ids().challenge, command));
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
        const r = await attempt(() => api.signUp(a, inviteToken));
        if (r === 'in') await reload();
        return r;
      },
      signIn: async (a) => {
        const ok = await attempt(() => api.signIn(a));
        if (ok !== false) await reload();
        return ok !== false;
      },
      sendLink: async (a) =>
        (await attempt(() => api.sendLink(a, inviteToken))) !== false,
      verifyCode: async (a) => {
        const ok = await attempt(() => api.verifyCode(a));
        if (ok !== false) await reload();
        return ok !== false;
      },
      signOut: async () => {
        await api.signOut();
        writeSession(INVITE_KEY, null);
        writeSession(LINK_KEY, null);
        inviteToken = null;
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
        const ok = await attempt(() =>
          api.finishSetup(challenge, draft, me, partner),
        );
        if (ok === false) return false;
        await reload();
        navigate(null);
        return true;
      },
      inviteLink: async () => {
        const { world: w } = latest.current;
        const kept = readSession(LINK_KEY);
        if (kept) {
          const saved = JSON.parse(kept) as {
            challenge: string;
            link: string;
            code: string;
          };
          if (saved.challenge === w.challenge.id) return saved;
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
        };
        writeSession(LINK_KEY, JSON.stringify(out));
        return out;
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
        writeSession(INVITE_KEY, null);
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
