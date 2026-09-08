"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DateTime } from "luxon";
import { attachPhoto, removePhoto, saveEntry } from "@/app/actions/entries";
import { createClient } from "@/lib/supabase/client";
import { PHOTO_BUCKET_NAME } from "@/lib/constants";
import { STATUS_LABEL, statusTone } from "@/lib/derive";
import { formatDate, formatInstant } from "@/lib/scoring";
import type { Challenge, EntryWithPhotos, Rule } from "@/lib/types";
import { Badge, Section } from "./ui";

interface Props {
  challenge: Challenge;
  meId: string;
  date: string;
  today: string;
  dates: { date: string; locked: boolean }[];
  locked: boolean;
  lockAtIso: string;
  rules: Rule[];
  entries: Record<string, EntryWithPhotos>;
}

export function DailyLog(props: Props) {
  const router = useRouter();
  const { challenge, date, today, dates, locked, lockAtIso, rules, entries } = props;
  const yesterday = DateTime.fromISO(today).minus({ days: 1 }).toISODate();
  const label = date === today ? "Today" : date === yesterday ? "Yesterday" : formatDate(date);

  return (
    <Section
      id="log"
      title={`Log ${label.toLowerCase()}`}
      subtitle={formatDate(date, "EEEE, MMMM d")}
      action={
        <select
          className="input w-auto shrink-0 py-1 text-sm"
          value={date}
          onChange={(e) => router.push(`/?date=${e.target.value}#log`)}
        >
          {dates.map((d) => (
            <option key={d.date} value={d.date}>
              {d.date === today ? "Today" : d.date === yesterday ? "Yesterday" : formatDate(d.date)}{d.locked ? " 🔒" : ""}
            </option>
          ))}
        </select>
      }
    >
      <LockBanner locked={locked} lockAtIso={lockAtIso} tz={challenge.timezone} />
      <div className="mt-2 flex flex-col gap-2">
        {rules.length === 0 && <div className="card p-4 text-sm text-muted">No rules apply on this day.</div>}
        {rules.map((rule) => (
          <RuleCard key={`${rule.id}:${entries[rule.id]?.updated_at ?? "new"}:${entries[rule.id]?.photos.length ?? 0}`} rule={rule} entry={entries[rule.id]} date={date} locked={locked} meId={props.meId} tz={challenge.timezone} />
        ))}
      </div>
    </Section>
  );
}

function LockBanner({ locked, lockAtIso, tz }: { locked: boolean; lockAtIso: string; tz: string }) {
  const [now, setNow] = useState(() => DateTime.now());
  useEffect(() => {
    const t = setInterval(() => setNow(DateTime.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const lockAt = DateTime.fromISO(lockAtIso);
  if (locked) {
    return (
      <div className="rounded-xl bg-line/60 px-3 py-2 text-xs text-muted">
        🔒 Locked {formatInstant(lockAtIso, tz)}. You can still request forgiveness on any points below.
      </div>
    );
  }
  const diff = lockAt.diff(now, ["hours", "minutes"]).toObject();
  const h = Math.max(0, Math.floor(diff.hours ?? 0));
  const m = Math.max(0, Math.floor(diff.minutes ?? 0));
  return (
    <div className="rounded-xl bg-accent-soft px-3 py-2 text-xs text-accent">
      ⏳ Locks in {h > 0 ? `${h}h ` : ""}{m}m ({formatInstant(lockAtIso, tz, "EEE h:mm a")})
    </div>
  );
}

function RuleCard({ rule, entry, date, locked, meId, tz }: {
  rule: Rule; entry?: EntryWithPhotos; date: string; locked: boolean; meId: string; tz: string;
}) {
  const [done, setDone] = useState<boolean | null>(entry?.done ?? null);
  const [note, setNote] = useState(entry?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const photos = entry?.photos ?? [];
  const canMarkDone = !rule.proof_required || photos.length > 0;

  const save = (nextDone: boolean, nextNote = note) => {
    setError(null);
    const previous = done;
    setDone(nextDone);
    startTransition(async () => {
      const res = await saveEntry({ ruleId: rule.id, date, done: nextDone, note: nextNote });
      if (!res.ok) {
        setDone(previous);
        setError(res.error);
      }
    });
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    setUploading(true);
    try {
      const [{ default: exifr }, { default: compress }] = await Promise.all([import("exifr"), import("browser-image-compression")]);
      const supabase = createClient();
      for (const file of Array.from(files)) {
        let takenAt: string | null = null;
        try {
          const exif = await exifr.parse(file, ["DateTimeOriginal"]);
          const d = exif?.DateTimeOriginal;
          if (d instanceof Date && !Number.isNaN(d.getTime())) takenAt = d.toISOString();
        } catch {
          // no EXIF (typical for screenshots)
        }
        const blob = await compress(file, { maxWidthOrHeight: 1600, initialQuality: 0.8, fileType: "image/jpeg", maxSizeMB: 1.5, useWebWorker: true });
        const path = `${meId}/${date}/${rule.id}/${crypto.randomUUID()}.jpg`;
        const { error: upErr } = await supabase.storage.from(PHOTO_BUCKET_NAME).upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (upErr) throw new Error(upErr.message);
        const res = await attachPhoto({ ruleId: rule.id, date, storagePath: path, takenAt });
        if (!res.ok) throw new Error(res.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

  const onRemovePhoto = (photoId: string) => {
    setError(null);
    startTransition(async () => {
      const res = await removePhoto(photoId);
      if (!res.ok) setError(res.error);
    });
  };

  const busy = pending || uploading;
  const disabled = locked || busy;

  return (
    <div className="card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="font-semibold leading-tight">{rule.title}</h3>
            {rule.proof_required && <Badge tone="bg-accent-soft text-accent">📷 proof</Badge>}
            {rule.cadence === "weekly" && <Badge tone="bg-line text-muted">weekly ×{rule.weekly_target}</Badge>}
            {entry && entry.done !== null && <Badge tone={statusTone(entry.status, entry.done)}>{STATUS_LABEL[entry.status]}</Badge>}
          </div>
          {rule.description && <p className="mt-0.5 text-xs text-muted">{rule.description}</p>}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled || !canMarkDone}
          onClick={() => save(true)}
          className={`btn ${done === true ? "btn-good" : "btn-ghost"}`}
          title={!canMarkDone ? "Attach a photo first" : undefined}
        >
          ✅ Done
        </button>
        <button type="button" disabled={disabled} onClick={() => save(false)} className={`btn ${done === false ? "btn-bad" : "btn-ghost"}`}>
          ❌ Not done
        </button>
      </div>
      {rule.proof_required && !canMarkDone && !locked && (
        <p className="mt-1 text-xs text-muted">Attach a screenshot to unlock “Done”.</p>
      )}

      {(rule.proof_required || photos.length > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {photos.map((p) => (
            <div key={p.id} className="relative">
              {p.url ? (
                <a href={p.url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="proof" className="h-20 w-20 rounded-lg object-cover" />
                </a>
              ) : (
                <div className="h-20 w-20 rounded-lg bg-line" />
              )}
              {p.taken_at && <div className="mt-0.5 max-w-20 truncate text-[10px] text-muted">{formatInstant(p.taken_at, tz)}</div>}
              {!locked && (
                <button
                  type="button"
                  onClick={() => onRemovePhoto(p.id)}
                  disabled={busy}
                  className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-foreground text-[10px] text-white"
                  aria-label="Remove photo"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {!locked && (
            <label className={`btn btn-ghost h-20 w-20 flex-col text-xs ${busy ? "opacity-50" : ""}`}>
              <span className="text-lg">{uploading ? "⏳" : "📷"}</span>
              {uploading ? "Uploading" : "Add"}
              <input type="file" accept="image/*" multiple className="hidden" disabled={disabled} onChange={(e) => onFiles(e.target.files)} />
            </label>
          )}
        </div>
      )}

      <textarea
        className="input mt-2 min-h-9 resize-y text-sm"
        rows={1}
        placeholder="Note (optional)"
        value={note}
        disabled={locked}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => {
          if (done !== null && (note ?? "") !== (entry?.note ?? "")) save(done, note);
        }}
      />
      {error && <p className="mt-1 text-xs text-bad">{error}</p>}
    </div>
  );
}
