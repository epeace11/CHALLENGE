'use client';
import type { Rule } from '@/lib/next/model';
import { Card, GlassCard } from '@/components/next/ui';
import { sentencePieces } from './draft';
import styles from './say.module.css';

/**
 * What was said, in quotes. While drafting, each part that becomes a rule lights up in turn
 * (`lit` is how many so far); afterwards it is plain.
 */
export function Sentence({
  text,
  rules,
  lit = 0,
  quiet,
}: {
  text: string;
  rules: Rule[];
  lit?: number;
  /** Smaller and softer, once the rules drafted from it matter more. */
  quiet?: boolean;
}) {
  const pieces = sentencePieces(text.trim(), rules);
  return (
    <p
      className={quiet ? 'text-nx-2 text-nx-ink-2' : 'text-nx-body text-nx-ink'}
    >
      “
      {pieces.map((p, i) =>
        p.step ? (
          <mark
            key={i}
            className={styles.mark}
            data-lit={p.step <= lit || undefined}
          >
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
      ”
    </p>
  );
}

/** Placeholder cards that appear one by one while the rules are drafted. */
export function DraftingCards({
  count,
  compact,
}: {
  count: number;
  compact?: boolean;
}) {
  const Box = compact ? Card : GlassCard;
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <Box
          key={i}
          pad={compact ? 'sm' : 'md'}
          className="nx-enter flex items-center gap-3.5"
        >
          <span className={styles.ghostDot} />
          <span className="flex flex-1 flex-col gap-2.5">
            <span className={styles.bar} style={{ width: `${62 - i * 9}%` }} />
            <span className={styles.bar} style={{ width: `${84 - i * 6}%` }} />
          </span>
        </Box>
      ))}
    </div>
  );
}
