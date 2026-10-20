'use client';
import { cn } from '@/lib/utils';

/**
 * Where the wizard is: one short word per step over a bar that fills up to the current step. Each
 * step is a button that goes straight to it.
 */
export function StepNav({
  steps,
  current,
  onGo,
}: {
  steps: { id: string; label: string }[];
  current: number;
  onGo: (index: number) => void;
}) {
  return (
    <nav aria-label="Steps">
      <ol
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
        }}
      >
        {steps.map((step, i) => (
          <li key={step.id} className="min-w-0">
            <button
              type="button"
              aria-current={i === current ? 'step' : undefined}
              onClick={() => onGo(i)}
              className="nx-press flex min-h-11 w-full flex-col justify-end gap-1.5 rounded-nx-sm pt-1 text-left"
            >
              <span
                className={cn(
                  'truncate text-nx-2 font-semibold transition-colors duration-200',
                  i === current ? 'text-nx-ink' : 'text-nx-ink-2',
                )}
              >
                {step.label}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  'h-1.5 w-full rounded-full transition-colors duration-200',
                  i <= current ? 'bg-nx-accent' : 'bg-nx-line-strong',
                )}
              />
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
