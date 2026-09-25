import { tones, toneLabel, total, type Counts } from '@/lib/progress';

/** A stacked bar of habit-days by colour. */
export function ToneBar({
  counts,
  compact = false,
}: {
  counts: Counts;
  compact?: boolean;
}) {
  const t = total(counts) || 1;
  return (
    <div className={compact ? 'bar thin' : 'bar'}>
      <span className="sr-only">
        {tones
          .filter((x) => counts[x])
          .map((x) => `${counts[x]} ${toneLabel[x]}`)
          .join(', ')}
      </span>
      {tones.map(
        (x) =>
          counts[x] > 0 && (
            <i
              key={x}
              className={`seg ${x}`}
              style={{ width: `${(counts[x] / t) * 100}%` }}
            />
          ),
      )}
    </div>
  );
}

export function ToneLegend() {
  return (
    <div className="bar-legend">
      {tones.map((x) => (
        <span key={x}>
          <i className={`seg ${x}`} />
          {toneLabel[x]}
        </span>
      ))}
    </div>
  );
}
