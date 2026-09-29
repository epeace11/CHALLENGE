'use client';
import { PencilRuler } from 'lucide-react';
import type { PageId } from '../nav';
import { EmptyState, GlassCard, PageTitle } from '../ui';
import { PAGE_META } from './meta';

/** Stands in for a version until its design lands. Workers replace the version file that uses it. */
export function Placeholder({
  page,
  version,
}: {
  page: PageId;
  version: number;
}) {
  const meta = PAGE_META[page];
  return (
    <div className="flex flex-col gap-6 py-4">
      <PageTitle kicker={`Version ${version}`} title={meta.title} />
      <GlassCard pad="lg" className="nx-enter">
        <EmptyState icon={PencilRuler} title="Not designed yet">
          {meta.brief}
        </EmptyState>
      </GlassCard>
    </div>
  );
}
