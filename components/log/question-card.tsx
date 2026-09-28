'use client';
import { useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  LoaderCircle,
  Paperclip,
} from 'lucide-react';
import { useChallenge } from '@/components/app/challenge-context';
import { Proofs } from '@/components/shared/proofs';
import { EntryPill, NotAnswered } from '@/components/shared/status-pill';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { api } from '@/lib/api';
import {
  askOption,
  draftChanged,
  draftProblem,
  savedDraft,
  submission,
  type Draft,
} from '@/lib/checkin';
import { closed } from '@/lib/dates';
import { locked } from '@/lib/progress';
import { MAX_PROOFS, uploadProof } from '@/lib/proof';
import type { Rule } from '@/lib/rules';
import { findEntry, weekCount } from '@/lib/selectors';
import { targetFor, weekOf } from '@/lib/weeks';
import { ForgivenessField } from './forgiveness-ask';

/**
 * One habit's check-in for the day being logged. Yes or No, a note, screenshots and a forgiveness
 * request stay a draft until Save, which sends the whole check-in at once and opens the next one.
 * Keyed by question, so a problem shown after a Save attempt starts hidden on the next.
 */
export function QuestionCard({
  active,
  onSaved,
}: {
  active: Rule[];
  onSaved: (rule: Rule) => void;
}) {
  const { data, me, partner, now, busy, finalized, run, log } = useChallenge();
  const { date, step, setStep, editing, setEditing } = log;
  const rule = active[Math.min(step, active.length - 1)];
  const entry = findEntry(data, me.id, rule.id, date);
  const key = `${date}|${rule.id}`,
    base = `${entry?.id ?? ''}|${entry?.updated_at ?? ''}`;
  const saved = savedDraft(entry),
    stored = log.drafts[key],
    draft = stored?.base === base ? stored.draft : saved;
  const edit = (change: (d: Draft) => Draft) =>
    log.editDraft(key, base, saved, change);
  const set = (patch: Partial<Draft>) => edit((d) => ({ ...d, ...patch }));

  const ask = askOption(data, entry, rule, date, now),
    problem = draftProblem(draft, rule, ask),
    changed = draftChanged(draft, saved, ask);
  const isLocked = locked(entry, now),
    readOnly = finalized || isLocked || entry?.status === 'disputed',
    unanswered =
      !entry || (entry.status === 'unlogged' && entry.proposed_done === null);
  const late = closed(date, now),
    single = editing === 'single',
    last = step >= active.length - 1,
    them = partner?.name ?? 'your partner';
  const [tried, setTried] = useState(false),
    [saving, setSaving] = useState(false),
    [uploading, setUploading] = useState(false),
    [noteOpen, setNoteOpen] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  /** The next check-in, or the day summary after the last one (or after one opened on its own). */
  const next = () => {
    if (single || last) {
      setEditing(false);
      return;
    }
    // A first answer on an empty day starts a full pass; otherwise the page would flip to the summary.
    setEditing('all');
    setStep(step + 1);
  };
  const save = async () => {
    if (readOnly) return next();
    if (problem) {
      setTried(true);
      return;
    }
    if (!changed) return next();
    setSaving(true);
    const ok = await run(() =>
      api.checkin({ rule: rule.id, day: date, ...submission(draft, ask) }),
    );
    setSaving(false);
    if (!ok) return;
    log.dropDraft(key);
    onSaved(rule);
    next();
  };
  /** Uploads each chosen screenshot and adds it to the draft; Save attaches them to the answer. */
  const upload = async (files: File[]) => {
    const added: string[] = [];
    setUploading(true);
    await run(async () => {
      if (draft.proofs.length + files.length > MAX_PROOFS)
        throw Error('Attach at most six screenshots.');
      for (const file of files) added.push(await uploadProof(me.id, file));
    });
    setUploading(false);
    if (added.length)
      edit((d) => ({
        ...d,
        done: d.done ?? true,
        proofs: [...d.proofs, ...added],
      }));
  };
  const w = weekOf(data.weeks, date);

  return (
    <section className="glass question" aria-busy={busy}>
      <div className="question-top">
        <p className="eyebrow">
          {rule.group} · {rule.days}
        </p>
        {entry && !unanswered ? <EntryPill entry={entry} /> : <NotAnswered />}
      </div>
      <h2>{rule.question}</h2>
      <p className="muted">
        {rule.weekly
          ? `${weekCount(data, w, me.id, rule.id)} of ${targetFor(w, rule.id)} ${rule.id === 'gym' ? 'visits' : 'days'} this week.`
          : rule.description}
      </p>
      <RadioGroup
        aria-label={rule.question}
        value={draft.done === null ? '' : draft.done ? 'yes' : 'no'}
        onValueChange={(v) => {
          const done = v === 'yes';
          set({ done });
          // A Yes that needs a screenshot starts by choosing one.
          if (done && rule.proof && !draft.proofs.length)
            picker.current?.click();
        }}
        className="answers"
        disabled={readOnly || busy}
      >
        {['yes', 'no'].map((v) => (
          <label
            key={v}
            className={`choice ${draft.done === (v === 'yes') ? 'selected' : ''}`}
          >
            <RadioGroupItem value={v} />
            {v === 'yes' ? 'Yes' : 'No'}
          </label>
        ))}
      </RadioGroup>
      {rule.proof && (!readOnly || draft.proofs.length > 0) && (
        <div className="attachment">
          <Proofs
            proof={draft.proofs.join('\n')}
            onRemove={
              readOnly || busy
                ? undefined
                : (paths) => edit((d) => ({ ...d, proofs: paths }))
            }
          />
          {!readOnly && (
            <label className="upload">
              {uploading ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <Paperclip size={16} />
              )}
              {uploading
                ? 'Uploading…'
                : draft.proofs.length
                  ? 'Add another screenshot'
                  : 'Attach screenshot'}
              {!draft.proofs.length && !uploading && (
                <small className="muted">needed for a Yes</small>
              )}
              <input
                ref={picker}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                disabled={busy}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length) void upload(files);
                  e.target.value = '';
                }}
              />
            </label>
          )}
        </div>
      )}
      {draft.done !== null &&
        (readOnly ? (
          draft.note && <p className="checkin-note">“{draft.note}”</p>
        ) : noteOpen || draft.note ? (
          <label className="note">
            <span>Note</span>
            <textarea
              aria-label="Note (optional)"
              maxLength={2000}
              value={draft.note}
              placeholder="Anything to add?"
              disabled={busy}
              onChange={(e) => set({ note: e.target.value })}
            />
          </label>
        ) : (
          <button
            type="button"
            className="text-link add-note"
            onClick={() => setNoteOpen(true)}
          >
            + Add a note
          </button>
        ))}
      {draft.done === false && (
        <ForgivenessField
          option={readOnly && ask.kind === 'ask' ? { kind: 'none' } : ask}
          checked={draft.forgive}
          reason={draft.reason}
          partnerName={them}
          disabled={busy}
          onCheck={(forgive) => set({ forgive })}
          onReason={(reason) => set({ reason })}
        />
      )}
      {draft.done === true &&
        changed &&
        !late &&
        ask.kind === 'sent' &&
        ask.status === 'pending' && (
          <p className="muted forgiveness-status">
            Saving a Yes withdraws your forgiveness request.
          </p>
        )}
      {entry?.status === 'unlogged' && entry.proposed_done === null && (
        <p className="muted">
          Not logged by the deadline, so it counts as a miss unless {them}{' '}
          approves a late answer.
        </p>
      )}
      {entry?.proposed_done !== null && entry?.proposed_done !== undefined && (
        <p className="muted">
          Your late correction is awaiting {them}’s approval.
        </p>
      )}
      {isLocked && (
        <p className="muted locked-note">
          Locked in. The deadline has passed and this answer is settled.
        </p>
      )}
      {entry?.status === 'disputed' && (
        <p className="muted">
          Resolve this entry’s dispute in Review before editing.
        </p>
      )}
      {finalized && <p className="muted">This challenge is finalized.</p>}
      {!readOnly &&
        (tried && problem ? (
          <p className="checkin-hint problem" role="alert">
            {problem}
          </p>
        ) : changed ? (
          <p className="checkin-hint">
            <i className="unsaved-dot" aria-hidden="true" />
            <span>
              Not saved yet. Save sends{' '}
              {late
                ? `this late correction to ${them} for approval.`
                : draft.done === false && draft.forgive && ask.kind === 'ask'
                  ? `your answer and forgiveness request to ${them}.`
                  : `it to ${them}${draft.done ? ' for review' : ''}.`}
            </span>
          </p>
        ) : null)}
      <div className={`question-footer${single ? ' single' : ''}`}>
        {single ? (
          !readOnly && (
            <button
              disabled={busy}
              onClick={() => {
                log.dropDraft(key);
                setEditing(false);
              }}
            >
              Cancel
            </button>
          )
        ) : (
          <button
            disabled={step === 0 || busy}
            onClick={() => setStep(step - 1)}
          >
            <ChevronLeft size={16} /> Back
          </button>
        )}
        <span className="footer-end">
          {!single && unanswered && !readOnly && (
            <button
              type="button"
              className="text-link skip"
              disabled={busy}
              onClick={next}
            >
              Skip
            </button>
          )}
          <button
            className="primary"
            disabled={busy}
            onClick={() => void save()}
          >
            {saving ? (
              <>
                Saving <LoaderCircle size={16} className="spin" />
              </>
            ) : readOnly ? (
              <>
                {single ? 'Done' : 'Next'} <ArrowRight size={16} />
              </>
            ) : (
              <>
                Save <Check size={16} />
              </>
            )}
          </button>
        </span>
      </div>
    </section>
  );
}
