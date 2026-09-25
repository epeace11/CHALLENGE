'use client';
import { useState } from 'react';
import { ArrowRight, Check, ChevronLeft, Paperclip } from 'lucide-react';
import { useChallenge } from '@/components/app/challenge-context';
import { Proofs } from '@/components/shared/proofs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { api } from '@/lib/api';
import { locked } from '@/lib/progress';
import { MAX_PROOFS, joinProofs, proofPaths, uploadProof } from '@/lib/proof';
import type { Rule } from '@/lib/rules';
import { findEntry, weekCount } from '@/lib/selectors';
import { targetFor, weekOf } from '@/lib/weeks';
import { ForgivenessAsk } from './forgiveness-ask';

/** One habit's question for the day being logged. Every change saves immediately. */
export function QuestionCard({ active }: { active: Rule[] }) {
  const { data, me, now, busy, finalized, run, go, log } = useChallenge();
  const { date, step, setStep, editing, setEditing } = log;
  const rule = active[Math.min(step, active.length - 1)];
  const entry = findEntry(data, me.id, rule?.id, date),
    entryLocked = locked(entry, now);
  const answer = entry?.proposed_done ?? entry?.done,
    savedNote = entry?.proposed_note ?? entry?.note ?? '',
    proof = entry?.proposed_proof ?? entry?.proof ?? null;
  // The note box follows the saved note whenever the answer, day or question changes.
  const [note, setNote] = useState(savedNote),
    noteKey = `${entry?.id}|${entry?.updated_at}|${date}|${step}`,
    [noteFor, setNoteFor] = useState(noteKey);
  if (noteFor !== noteKey) {
    setNoteFor(noteKey);
    setNote(savedNote);
  }

  // The first answer on a day with nothing recorded starts a full pass; otherwise the Log page would flip to the day summary as soon as it saved.
  const keepLogging = () => {
    if (!editing) setEditing('all');
  };
  const save = async (done: boolean, withProof = proof) => {
    keepLogging();
    await run(() =>
      api.log({ rule: rule.id, day: date, done, note, proof: withProof }),
    );
  };
  /** Uploads each chosen screenshot, adds it to the answer's existing ones and saves the answer as done. */
  const upload = async (files: File[]) => {
    keepLogging();
    await run(async () => {
      const paths = proofPaths(proof);
      if (paths.length + files.length > MAX_PROOFS)
        throw Error('Attach at most six screenshots.');
      for (const file of files) paths.push(await uploadProof(me.id, file));
      await api.log({
        rule: rule.id,
        day: date,
        done: true,
        note,
        proof: joinProofs(paths),
      });
    });
  };
  const frozen = busy || finalized || entryLocked;
  const w = weekOf(data.weeks, date);

  return (
    <section className="glass question" aria-busy={busy}>
      <p className="eyebrow">
        {rule.group} · {rule.days}
      </p>
      <h2>{rule.question}</h2>
      <p className="muted">
        {rule.weekly
          ? `${weekCount(data, w, me.id, rule.id)} of ${targetFor(w, rule.id)} ${rule.id === 'gym' ? 'visits' : 'days'} this week.`
          : rule.description}
      </p>
      <RadioGroup
        aria-label={rule.question}
        value={answer === undefined ? '' : answer ? 'yes' : 'no'}
        onValueChange={(v) => {
          // A Yes that needs a screenshot starts by choosing one.
          if (
            v === 'yes' &&
            rule.proof &&
            !entry?.proof &&
            !entry?.proposed_proof
          ) {
            document.getElementById('proof-upload')?.click();
            return;
          }
          void save(v === 'yes');
        }}
        className="answers"
        disabled={frozen || entry?.status === 'disputed'}
      >
        {['yes', 'no'].map((v) => (
          <label
            key={v}
            className={`choice ${answer === (v === 'yes') ? 'selected' : ''}`}
          >
            <RadioGroupItem value={v} />
            {v === 'yes' ? 'Yes' : 'No'}
          </label>
        ))}
      </RadioGroup>
      {rule.proof && (
        <div className="attachment">
          <Proofs
            proof={proof}
            onRemove={
              busy || finalized || entry?.status === 'disputed'
                ? undefined
                : (paths) => void save(answer ?? true, joinProofs(paths))
            }
            keepOne={answer === true}
          />
          <label className="upload" htmlFor="proof-upload">
            <Paperclip size={16} />
            {proofPaths(proof).length
              ? 'Add another screenshot'
              : 'Attach screenshot'}
            <input
              id="proof-upload"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              disabled={frozen}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length) void upload(files);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      )}
      {answer !== undefined && (
        <details className="note">
          <summary>Add a note</summary>
          <textarea
            aria-label="Optional note"
            maxLength={2000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => {
              if (note !== savedNote) void save(answer);
            }}
            placeholder="Anything to add?"
            disabled={frozen}
          />
        </details>
      )}
      {entryLocked && (
        <p className="muted locked-note">
          Locked in. The deadline has passed and this answer is settled.
        </p>
      )}
      {answer === false && !rule.weekly && !finalized && !entryLocked && (
        <ForgivenessAsk key={noteKey} entry={entry} />
      )}
      {entry?.proposed_done !== null && entry?.proposed_done !== undefined && (
        <p className="muted">
          Your late correction is awaiting partner approval.
        </p>
      )}
      {entry?.status === 'disputed' && (
        <p className="muted">
          Resolve this entry’s dispute in Review before editing.
        </p>
      )}
      {finalized && <p className="muted">This challenge is finalized.</p>}
      {editing === 'single' ? (
        <div className="question-footer single">
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              void (async () => {
                if (answer !== undefined && note !== savedNote)
                  await save(answer);
                setEditing(false);
              })()
            }
          >
            Save
            <Check size={16} />
          </button>
        </div>
      ) : (
        <div className="question-footer">
          <button
            disabled={step === 0 || busy}
            onClick={() => setStep(step - 1)}
          >
            <ChevronLeft size={16} /> Back
          </button>
          <button
            className="primary"
            disabled={busy}
            onClick={() => {
              if (step < active.length - 1) setStep(step + 1);
              else {
                setEditing(false);
                go('Overview');
              }
            }}
          >
            {step === active.length - 1 ? 'Overview' : 'Next'}
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </section>
  );
}
