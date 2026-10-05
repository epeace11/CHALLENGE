'use client';
import { useState } from 'react';
import { RecoveryScreen, SignInScreen } from '@/components/auth/auth-screens';
import { BadgeCelebration } from '@/components/dialogs/badge-celebration';
import { DetailDialog } from '@/components/dialogs/detail-dialog';
import {
  DisputeDialog,
  ForgivenessDialog,
} from '@/components/dialogs/text-dialog';
import { LogPage } from '@/components/log/log-page';
import { OverviewPage } from '@/components/overview/overview-page';
import { ProgressPage } from '@/components/progress/progress-page';
import { ReviewPage } from '@/components/review/review-page';
import { RulesPage } from '@/components/rules/rules-page';
import { Loading } from '@/components/shared/loading';
import { useAuth } from '@/hooks/use-auth';
import { useChallengeData } from '@/hooks/use-challenge-data';
import { useDemo, useDemoStore, type Demo } from '@/hooks/use-demo';
import { usePageTool } from '@/hooks/use-page-tool';
import { reviewQueue } from '@/lib/selectors';
import {
  ChallengeProvider,
  NAV_PAGES,
  useChallenge,
  type Page,
} from './challenge-context';
import { Shell } from './shell';

/** Pages the WebMCP navigation tool may open: the navigation bar's plus Rules. */
const TOOL_PAGES = [...NAV_PAGES, 'Rules'] as const;

const PAGE_COMPONENTS: Record<Page, () => React.JSX.Element> = {
  Overview: OverviewPage,
  Log: LogPage,
  Review: ReviewPage,
  Progress: ProgressPage,
  Rules: RulesPage,
};

/** The live app, or on localhost with ?demo the same pages over made-up data (hooks/use-demo.ts). */
export function App() {
  const demo = useDemo();
  if (demo === undefined) return <Loading />;
  return demo ? <DemoApp demo={demo} /> : <LiveApp />;
}

function DemoApp({ demo }: { demo: Demo }) {
  const store = useDemoStore();
  const [page, setPage] = useState<Page>('Overview');
  const me = store.data.profiles.find((p) => p.name === demo.as)!;
  return (
    <ChallengeProvider me={me} store={store} page={page} setPage={setPage}>
      <p className="demo-banner">Demo data as {me.name} · nothing is saved</p>
      <ChallengeApp />
    </ChallengeProvider>
  );
}

/** Signs the user in, loads the challenge, and shows the current page. */
function LiveApp() {
  const auth = useAuth();
  const uid = auth.session?.user.id;
  const store = useChallengeData(uid);
  const [page, setPage] = useState<Page>('Overview');
  usePageTool(TOOL_PAGES, setPage);

  if (!auth.ready) return <Loading />;
  if (!auth.session) return <SignInScreen />;
  if (auth.recovery) return <RecoveryScreen onDone={auth.endRecovery} />;

  const me = store.data.profiles.find((p) => p.id === uid);
  if (!me)
    return (
      <Shell
        page={page}
        go={(p) => {
          setPage(p);
          store.setError('');
        }}
        reviewDot={false}
        reviewCount={0}
        newBadges={0}
        error={store.error}
        setError={store.setError}
        refresh={store.refresh}
      >
        {store.loading ? (
          <Loading inline />
        ) : (
          <section className="glass empty">
            <h2>Your account is connected.</h2>
            <p>
              The shared challenge database needs to be initialized before you
              can log.
            </p>
            <button onClick={() => void store.refresh()}>Refresh</button>
          </section>
        )}
      </Shell>
    );

  return (
    <ChallengeProvider me={me} store={store} page={page} setPage={setPage}>
      <ChallengeApp />
    </ChallengeProvider>
  );
}

function ChallengeApp() {
  const { data, me, page, go, error, refresh, setError, newBadges } =
    useChallenge();
  const queue = reviewQueue(data, me.id);
  const Current = PAGE_COMPONENTS[page];
  return (
    <>
      <Shell
        page={page}
        go={go}
        name={me.name}
        reviewDot={queue.any}
        reviewCount={queue.count}
        newBadges={newBadges.fresh.length}
        error={error}
        setError={setError}
        refresh={refresh}
      >
        <Current />
      </Shell>
      <DetailDialog />
      <DisputeDialog />
      <ForgivenessDialog />
      <BadgeCelebration />
    </>
  );
}
