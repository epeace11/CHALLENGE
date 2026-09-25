'use client';
import { useEffect } from 'react';

type ModelContext = {
  registerTool: (tool: unknown, options: unknown) => Promise<void>;
};

/** Registers the WebMCP `open_challenge_page` tool where the browser supports it. Navigation only: it cannot change habit records. Pass a stable `open` (a state setter). */
export function usePageTool<P extends string>(
  pages: readonly P[],
  open: (p: P) => void,
) {
  useEffect(() => {
    const ctx = (document as unknown as { modelContext?: ModelContext })
      .modelContext;
    if (!ctx) return;
    const controller = new AbortController();
    void Promise.resolve(
      ctx.registerTool(
        {
          name: 'open_challenge_page',
          title: 'Open a challenge page',
          description:
            'Navigate to a challenge page. Does not change habit records.',
          inputSchema: {
            type: 'object',
            properties: { page: { type: 'string', enum: pages } },
            required: ['page'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false },
          execute: (input: { page: string }) => {
            const page = input.page as P;
            if (!pages.includes(page)) throw Error('Unknown page');
            open(page);
            return { page };
          },
        },
        { signal: controller.signal },
      ),
    ).catch(() => {});
    return () => controller.abort();
  }, [pages, open]);
}
