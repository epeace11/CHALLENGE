import type { Metadata } from 'next';
import { Preview } from '@/components/next/preview';

export const metadata: Metadata = {
  title: 'Preview · The Challenge',
  description:
    'Every page of the new product, in 2 or 3 versions, on sample data.',
};

/** The design preview: ?page=overview&v=2 opens a page's version, ?kit the kit, and nothing the index. */
export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const page = typeof params.page === 'string' ? params.page : undefined;
  const v = typeof params.v === 'string' ? Number(params.v) : undefined;
  return (
    <Preview
      initialPage={page}
      initialVersion={v !== undefined && Number.isFinite(v) ? v : undefined}
      initialKit={params.kit !== undefined}
    />
  );
}
