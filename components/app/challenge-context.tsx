'use client';
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useNewBadges } from '@/hooks/use-new-badges';
import { useNow } from '@/hooks/use-now';
import type { Draft } from '@/lib/checkin';
import { START, clampDate, defaultDate, shift, toronto } from '@/lib/dates';
import {
  badges,
  askedEntries,
  daysWon,
  habitOrder,
  habitStats,
  index,
  personBar,
  type Badge,
  type Counts,
  type HabitStat,
} from '@/lib/progress';
import type { Data, Entry, Point, Profile } from '@/lib/types';

/** Pages in the navigation bars. Rules is reached from the Overview. */
export const NAV_PAGES = ['Overview', 'Log', 'Review', 'Progress'] as const;
export type Page = (typeof NAV_PAGES)[number] | 'Rules';

/** How the Log page is showing the day: its summary (false), every question in turn, or one question. */
export type Editing = false | 'all' | 'single';

/** The entry, habit and day views share one dialog; an entry can open over a habit or day view. */
export type DetailView = {
  entry: Entry | null;
  habit: string | null;
  day: { d: string; uid: string } | null;
};

type Store = {
  data: Data;
  finalized: boolean;
  loading: boolean;
  error: string;
  refresh: (sync?: boolean) => Promise<void>;
  setError: (e: string) => void;
};

function useChallengeState(
  me: Profile,
  store: Store,
  page: Page,
  setPage: (p: Page) => void,
) {
  const { data, refresh, setError } = store;
  const now = useNow();
  const partner = data.profiles.find((p) => p.id !== me.id);
  const today = toronto(),
    maxDate = clampDate(shift(today, -1));

  const [busy, setBusy] = useState(false);
  /** Runs one change, then reloads (the write already ran the deadline checks, so the reload skips them). Any failure shows in the error bar; returns whether it succeeded. */
  const run = async (fn: () => Promise<unknown>) => {
    setError('');
    setBusy(true);
    try {
      await fn();
      await refresh(false);
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Something went wrong. Please retry.',
      );
      return false;
    } finally {
      setBusy(false);
    }
  };

  /** Opens a page at its top, or scrolled to the element with id `anchor`. */
  const go = (target: Page, anchor?: string) => {
    setPage(target);
    setError('');
    // Pages share one scroll position, so without this a page would open wherever the last one was scrolled to.
    requestAnimationFrame(() => {
      const el = anchor ? document.getElementById(anchor) : null;
      if (el) el.scrollIntoView({ block: 'start' });
      else window.scrollTo(0, 0);
    });
  };

  // The Log page: which day, which question, and how it is shown.
  const [date, setDate] = useState(defaultDate),
    [step, setStep] = useState(0),
    [editing, setEditing] = useState<Editing>(false);
  const changeDate = (v: string) => {
    if (v > maxDate || v < START) return;
    setDate(v);
    setStep(0);
    setEditing(false);
  };
  const startEditing = (at: number, mode: 'all' | 'single' = 'all') => {
    setStep(Math.max(at, 0));
    setEditing(mode);
  };
  // Unsaved check-ins by `${day}|${rule}`. Each remembers the saved entry version it started from
  // (`base`) and is ignored once that changes. Moving between questions keeps them; only Save sends one.
  const [drafts, setDrafts] = useState<
    Record<string, { base: string; draft: Draft }>
  >({});
  const editDraft = (
    key: string,
    base: string,
    from: Draft,
    change: (d: Draft) => Draft,
  ) =>
    setDrafts((all) => ({
      ...all,
      [key]: {
        base,
        draft: change(all[key]?.base === base ? all[key].draft : from),
      },
    }));
  const dropDraft = (key: string) =>
    setDrafts((all) => {
      const next = { ...all };
      delete next[key];
      return next;
    });

  // Choices that survive switching pages.
  const [reviewTab, setReviewTab] = useState('entries'),
    [historyPerson, setHistoryPerson] = useState(''),
    [badgePerson, setBadgePerson] = useState(''),
    [showEntries, setShowEntries] = useState(false),
    [ledgerOpen, setLedgerOpen] = useState(false);

  // Dialogs.
  const [view, setView] = useState<DetailView>({
      entry: null,
      habit: null,
      day: null,
    }),
    [disputing, setDisputing] = useState<Entry | null>(null),
    [pointRequest, setPointRequest] = useState<Point | null>(null);
  const openEntry = (entry: Entry) => setView((v) => ({ ...v, entry }));
  const openHabit = (habit: string) => setView((v) => ({ ...v, habit }));
  const openDay = (d: string, uid: string) =>
    setView((v) => ({ ...v, day: { d, uid } }));
  const closeViews = () => setView({ entry: null, habit: null, day: null });
  /** Closes the entry view, going back to the day or habit view it came from unless `back` is false. */
  const closeEntry = (back = true) =>
    back ? setView((v) => ({ ...v, entry: null })) : closeViews();
  const closeTopView = () =>
    setView((v) =>
      v.entry
        ? { ...v, entry: null }
        : v.habit
          ? { ...v, habit: null }
          : { ...v, day: null },
    );

  // Statistics, recomputed when the data or the clock changes.
  const stats = useMemo(() => {
    const ix = index(data),
      per = <T,>(f: (p: Profile) => T) =>
        Object.fromEntries(data.profiles.map((p) => [p.id, f(p)])) as Record<
          string,
          T
        >;
    const habits = per((p) => habitStats(data, p, now, ix));
    return {
      ix,
      asked: askedEntries(data),
      bars: per<Counts>((p) => personBar(data, p, now, ix)),
      habits: habits as Record<string, HabitStat[]>,
      order: habitOrder(habits),
      won: daysWon(data, now, ix),
      earned: per<Badge[]>((p) => badges(data, p, now, ix)),
    };
  }, [data, now]);
  const newBadges = useNewBadges(me.id, stats.earned[me.id] ?? [], now);

  return {
    ...store,
    me,
    partner,
    now,
    today,
    maxDate,
    busy,
    run,
    page,
    go,
    stats,
    newBadges,
    log: {
      date,
      changeDate,
      step,
      setStep,
      editing,
      setEditing,
      startEditing,
      drafts,
      editDraft,
      dropDraft,
    },
    ui: {
      reviewTab,
      setReviewTab,
      historyPerson: historyPerson || me.id,
      setHistoryPerson,
      badgePerson: badgePerson || me.id,
      setBadgePerson,
      showEntries,
      setShowEntries,
      ledgerOpen,
      setLedgerOpen,
    },
    dialogs: {
      view,
      openEntry,
      openHabit,
      openDay,
      closeEntry,
      closeTopView,
      closeViews,
      disputing,
      setDisputing,
      pointRequest,
      setPointRequest,
    },
  };
}

export type Challenge = ReturnType<typeof useChallengeState>;

const ChallengeContext = createContext<Challenge | null>(null);

/** Everything the pages and dialogs share: the signed-in member, the data, navigation, the Log page's state and the open dialogs. */
export function ChallengeProvider({
  me,
  store,
  page,
  setPage,
  children,
}: {
  me: Profile;
  store: Store;
  page: Page;
  setPage: (p: Page) => void;
  children: ReactNode;
}) {
  const value = useChallengeState(me, store, page, setPage);
  return (
    <ChallengeContext.Provider value={value}>
      {children}
    </ChallengeContext.Provider>
  );
}

export function useChallenge() {
  const ctx = useContext(ChallengeContext);
  if (!ctx) throw Error('useChallenge must be used inside ChallengeProvider');
  return ctx;
}
