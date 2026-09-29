'use client';
import { useState } from 'react';
import type { DateString, Proof, Rule } from '@/lib/next/model';
import { formatWhen } from '@/lib/next/selectors';
import { screenTimeShot, stepsShot } from '@/lib/next/shots';
import { Glide, NumberField, ProofStrip, YesNo } from '@/components/next/ui';
import { cn } from '@/lib/utils';
import styles from './setup.module.css';

/**
 * The check-in card a rule makes, as it will look on Check in: the question, then Yes and No or a
 * number against the target, then the screenshot. It follows the builder as it is filled in, and
 * it answers for real (here only), so it can be tried.
 */
export function CheckinPreview({
  rule,
  who,
  day,
}: {
  rule: Rule;
  /** "Both of you", "Jordan". */
  who: string;
  /** The day sample screenshots are dated. */
  day: DateString;
}) {
  const [answer, setAnswer] = useState<boolean | null>(null);
  const [value, setValue] = useState<number | null>(null);
  const [proofs, setProofs] = useState<Proof[]>([]);
  const question = rule.question.trim();
  const asNumber = rule.kind === 'number';
  const unit = rule.target?.unit.trim() || undefined;

  const addShot = () => {
    const minutes = /min/i.test(unit ?? '');
    const src = minutes
      ? screenTimeShot(Math.round(value ?? 45), day)
      : stepsShot(Math.round(value ?? 10420), day);
    setProofs([
      ...proofs,
      { id: `preview-${proofs.length + 1}`, src, alt: 'Sample screenshot' },
    ]);
  };

  return (
    <section className={styles.preview} aria-label="Preview of the check-in">
      <div className="flex flex-col gap-1">
        <p className="nx-kicker">How it looks at check-in</p>
        <p className="text-nx-2 text-nx-ink-2">
          {who} · {formatWhen(rule)}
        </p>
      </div>
      <h3
        className={cn('font-nx-serif text-nx-h3', !question && 'text-nx-ink-2')}
      >
        {question || 'Your question shows here'}
      </h3>
      <Glide id={asNumber ? 'number' : 'yesno'}>
        {asNumber ? (
          <NumberField
            label={<span className="sr-only">{question || 'Your answer'}</span>}
            value={value}
            onChange={setValue}
            target={rule.target}
            unit={unit}
            decimals
          />
        ) : (
          <YesNo
            label={question || 'Your answer'}
            value={answer}
            onChange={setAnswer}
          />
        )}
      </Glide>
      {rule.proof !== 'none' && (
        <div className="flex flex-col gap-2">
          <p className="text-nx-2 text-nx-ink-2">
            {rule.proof === 'required'
              ? 'Screenshot required'
              : 'Screenshot optional'}
          </p>
          <ProofStrip
            proofs={proofs}
            onAdd={proofs.length < 3 ? addShot : undefined}
            onRemove={(id) => setProofs(proofs.filter((p) => p.id !== id))}
          />
        </div>
      )}
    </section>
  );
}
