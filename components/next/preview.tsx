'use client';
import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { Menu as BaseMenu } from '@base-ui/react/menu';
import {
  Check,
  LayoutGrid,
  Moon,
  Palette,
  Sun,
  TriangleAlert,
} from 'lucide-react';
import type { Look } from '@/lib/next/model';
import { LOOKS } from '@/lib/next/selectors';
import { updateChallenge } from '@/lib/next/actions';
import { KitGallery } from './kit-gallery';
import { NavContext, isPageId, type Nav, type PageId } from './nav';
import { PAGES, PAGE_GROUPS, pageById } from './pages/registry';
import { WorldProvider, useDemo } from './world';
import {
  Button,
  EmptyState,
  GlassCard,
  NxRoot,
  RowButton,
  Section,
  usePortalContainer,
} from './ui';

/**
 * The design preview at /preview: every page of the new product on sample data; a page in a design
 * round has 2 or 3 versions. Without a page it lists them all; with one it shows the page under a
 * slim bar (All pages, the page's name, 1 2 3 when it has versions, light/dark and the look). Page and version live in the
 * URL (?page=overview&v=2); each page remembers its last version in this browser. ?kit shows every
 * kit component.
 */

const BAR_HEIGHT = 60;
const VERSIONS_KEY = 'nx-preview-versions';
const LOOK_KEY = 'nx-preview-look';

/** What is on screen: a page's version, the kit, or (neither) the page index. */
type View = { page: PageId | null; version: number; kit?: boolean };
const INDEX: View = { page: null, version: 1 };

const versionCount = (page: PageId) => pageById(page).components.length;
const clampVersion = (page: PageId, v: number | undefined) =>
  v !== undefined && Number.isInteger(v) && v >= 1 && v <= versionCount(page)
    ? v
    : 1;

function readStored<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function store(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

const urlFor = (view: View) =>
  view.page
    ? `${location.pathname}?page=${view.page}&v=${view.version}`
    : view.kit
      ? `${location.pathname}?kit`
      : location.pathname;

/** The view the address bar describes. */
function viewFromLocation(): View {
  const params = new URLSearchParams(location.search);
  const page = params.get('page');
  if (isPageId(page))
    return { page, version: clampVersion(page, Number(params.get('v'))) };
  return params.has('kit') ? { ...INDEX, kit: true } : INDEX;
}

export function Preview({
  initialPage,
  initialVersion,
  initialKit,
}: {
  initialPage?: string;
  initialVersion?: number;
  initialKit?: boolean;
}) {
  return (
    <WorldProvider>
      <PreviewShell
        initial={
          isPageId(initialPage)
            ? {
                page: initialPage,
                version: clampVersion(initialPage, initialVersion),
              }
            : initialKit
              ? { ...INDEX, kit: true }
              : INDEX
        }
      />
    </WorldProvider>
  );
}

function PreviewShell({ initial }: { initial: View }) {
  const { world, update, reset } = useDemo();
  const [view, setView] = useState<View>(initial);
  // Last version chosen per page, kept in this browser.
  const remembered = useRef<Partial<Record<PageId, number>>>({});

  const setLook = useCallback(
    (look: Look) => {
      update((w) => updateChallenge(w, { look }), { undoable: false });
      store(LOOK_KEY, look);
    },
    [update],
  );

  // After the first render: what this browser remembers, and back/forward.
  useEffect(() => {
    remembered.current = readStored(VERSIONS_KEY) ?? {};
    const look = readStored<Look>(LOOK_KEY);
    if (look && LOOKS.some((l) => l.id === look))
      update((w) => updateChallenge(w, { look }), { undoable: false });
    const here = viewFromLocation();
    if (here.page && !new URLSearchParams(location.search).has('v')) {
      // Opened without a version: show the one chosen last time.
      const version = clampVersion(here.page, remembered.current[here.page]);
      setView({ page: here.page, version });
      history.replaceState(null, '', urlFor({ page: here.page, version }));
    }
    const onPop = () => setView(viewFromLocation());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [update]);

  const go = useCallback((next: View) => {
    setView(next);
    history.pushState(null, '', urlFor(next));
    window.scrollTo({ top: 0 });
  }, []);

  const navigate = useCallback<Nav['navigate']>(
    (page, options) =>
      go(
        page
          ? {
              page,
              version: clampVersion(
                page,
                options?.version ?? remembered.current[page],
              ),
            }
          : INDEX,
      ),
    [go],
  );

  const setVersion = useCallback(
    (version: number) =>
      setView((v) => {
        if (!v.page || v.version === version) return v;
        const next = { page: v.page, version };
        history.replaceState(null, '', urlFor(next));
        return next;
      }),
    [],
  );

  // Remember whichever version is on screen, and name the tab after it.
  useEffect(() => {
    if (view.page) {
      remembered.current = { ...remembered.current, [view.page]: view.version };
      store(VERSIONS_KEY, remembered.current);
    }
    document.title = view.page
      ? `${pageById(view.page).title} · ${view.version} · Preview`
      : view.kit
        ? 'Kit · Preview'
        : 'Preview · The Challenge';
  }, [view]);

  // 1, 2 and 3 switch versions on a keyboard (not while typing, and not with a sheet open).
  useEffect(() => {
    if (!view.page) return;
    const count = versionCount(view.page);
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
      )
        return;
      if (document.querySelector('.nx [role="dialog"]')) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= count) {
        e.preventDefault();
        setVersion(n);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view.page, setVersion]);

  const nav = useMemo<Nav>(
    () => ({ page: view.page, version: view.version, navigate }),
    [view, navigate],
  );
  const entry = view.page ? pageById(view.page) : null;
  const Version = entry?.components[view.version - 1];

  return (
    <NxRoot
      look={world.challenge.look}
      style={
        {
          ['--nx-top-inset' as string]: entry ? `${BAR_HEIGHT}px` : '0px',
        } as CSSProperties
      }
    >
      <NavContext.Provider value={nav}>
        {entry && Version ? (
          <>
            <VersionBar
              title={entry.title}
              count={entry.components.length}
              version={view.version}
              onVersion={setVersion}
              onAll={() => navigate(null)}
              look={world.challenge.look}
              onLook={setLook}
            />
            <div style={{ paddingTop: BAR_HEIGHT }}>
              <VersionBoundary key={`${entry.id}-${view.version}`}>
                <Version />
              </VersionBoundary>
            </div>
          </>
        ) : view.kit ? (
          <KitGallery />
        ) : (
          <PageIndex
            onOpen={(id) => navigate(id)}
            onKit={() => go({ ...INDEX, kit: true })}
            onReset={reset}
            look={world.challenge.look}
            onLook={setLook}
          />
        )}
      </NavContext.Provider>
    </NxRoot>
  );
}

/* ── The version bar ───────────────────────────────────────────────────── */

function VersionBar({
  title,
  count,
  version,
  onVersion,
  onAll,
  look,
  onLook,
}: {
  title: string;
  count: number;
  version: number;
  onVersion: (v: number) => void;
  onAll: () => void;
  look: Look;
  onLook: (look: Look) => void;
}) {
  return (
    <div className="nx-preview-bar" role="toolbar" aria-label="Preview">
      <button
        type="button"
        className="nx-pb-btn"
        aria-label="All pages"
        onClick={onAll}
      >
        <LayoutGrid size={20} aria-hidden="true" />
        <span className="hidden md:inline">All pages</span>
      </button>
      <span className="nx-pb-sep hidden sm:block" aria-hidden="true" />
      <span className="nx-pb-title">{title}</span>
      <div className="flex gap-1">
        {count > 1 &&
          Array.from({ length: count }, (_, i) => i + 1).map((v) => (
            <button
              key={v}
              type="button"
              className="nx-pb-btn nx-pb-version"
              aria-pressed={v === version}
              aria-label={`Version ${v}`}
              onClick={() => onVersion(v)}
            >
              {v}
            </button>
          ))}
      </div>
      <span className="nx-pb-sep hidden sm:block" aria-hidden="true" />
      <ThemeButton className="nx-pb-btn" />
      <LookMenu className="nx-pb-btn" look={look} onLook={onLook} />
    </div>
  );
}

/** Light or dark on <html data-theme>, shared with today's app (localStorage 'theme'). */
function ThemeButton({ className }: { className: string }) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const read = () =>
      setDark(document.documentElement.dataset.theme === 'dark');
    read();
    const watch = new MutationObserver(read);
    watch.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => watch.disconnect();
  }, []);
  const next = dark ? 'light' : 'dark';
  return (
    <button
      type="button"
      className={className}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      onClick={() => {
        document.documentElement.dataset.theme = next;
        document
          .querySelector('meta[name=theme-color]')
          ?.setAttribute('content', next === 'dark' ? '#0d0b14' : '#f6f8fb');
        try {
          localStorage.setItem('theme', next);
        } catch {}
      }}
    >
      {dark ? (
        <Sun size={20} aria-hidden="true" />
      ) : (
        <Moon size={20} aria-hidden="true" />
      )}
    </button>
  );
}

/** Classic, 75-Day, Sleep, Dry or Fitness: sets the challenge's look, which NxRoot shows. */
function LookMenu({
  className,
  look,
  onLook,
}: {
  className: string;
  look: Look;
  onLook: (look: Look) => void;
}) {
  const container = usePortalContainer();
  const label = LOOKS.find((l) => l.id === look)?.label ?? 'Classic';
  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger className={className} aria-label={`Look: ${label}`}>
        <Palette size={20} aria-hidden="true" />
        <span className="hidden sm:inline">{label}</span>
      </BaseMenu.Trigger>
      <BaseMenu.Portal container={container}>
        <BaseMenu.Positioner
          className="z-[70] outline-none"
          side="bottom"
          align="end"
          sideOffset={8}
          collisionPadding={12}
        >
          <BaseMenu.Popup className="nx-menu">
            <BaseMenu.RadioGroup
              value={look}
              onValueChange={(value: Look) => onLook(value)}
            >
              {LOOKS.map((l) => (
                <BaseMenu.RadioItem
                  key={l.id}
                  value={l.id}
                  closeOnClick
                  className="nx-menu-item"
                >
                  <span
                    className="size-4 shrink-0 rounded-full"
                    data-look={l.id}
                    style={{ background: 'var(--nx-accent)' }}
                    aria-hidden="true"
                  />
                  <span className="flex-1">{l.label}</span>
                  <BaseMenu.RadioItemIndicator>
                    <Check size={18} aria-hidden="true" />
                  </BaseMenu.RadioItemIndicator>
                </BaseMenu.RadioItem>
              ))}
            </BaseMenu.RadioGroup>
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}

/* ── The page index ────────────────────────────────────────────────────── */

function PageIndex({
  onOpen,
  onKit,
  onReset,
  look,
  onLook,
}: {
  onOpen: (id: PageId) => void;
  onKit: () => void;
  onReset: () => void;
  look: Look;
  onLook: (look: Look) => void;
}) {
  const choosing = PAGES.some((p) => p.components.length > 1);
  return (
    <main className="nx-main pt-6 pb-16 sm:pt-10">
      <header className="nx-enter">
        <div className="flex items-center gap-2">
          <h1 className="nx-page-title flex-1">Pages</h1>
          <ThemeButton className="nx-icon-btn" />
          <LookMenu
            className="nx-icon-btn inline-flex w-auto gap-2 rounded-full px-3.5 text-nx-2 font-semibold"
            look={look}
            onLook={onLook}
          />
        </div>
        <p className="mt-3 text-nx-body text-nx-ink-2">
          {PAGES.length} pages, all on sample data.
          {choosing && ' Pages with versions switch with 1, 2 and 3.'}
        </p>
      </header>
      {PAGE_GROUPS.map((group, g) => (
        <Section key={group} title={group} index={g + 1} className="mt-10">
          <ul className="flex flex-col gap-2.5">
            {PAGES.filter((p) => p.group === group).map((p) => (
              <li key={p.id}>
                <RowButton
                  title={p.title}
                  detail={
                    p.components.length > 1
                      ? `${p.components.length} versions`
                      : undefined
                  }
                  onClick={() => onOpen(p.id)}
                />
              </li>
            ))}
          </ul>
        </Section>
      ))}
      <div className="mt-10 flex flex-wrap gap-2">
        <Button variant="quiet" onClick={onKit}>
          See every kit component
        </Button>
        <Button variant="quiet" onClick={onReset}>
          Reset sample data
        </Button>
      </div>
    </main>
  );
}

/* ── A version that crashes shows its error instead of taking the preview down ── */

class VersionBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('A preview version crashed', error, info.componentStack);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="nx-main pt-10">
        <GlassCard pad="lg">
          <EmptyState icon={TriangleAlert} title="This version crashed">
            {this.state.error.message}
          </EmptyState>
        </GlassCard>
      </main>
    );
  }
}
