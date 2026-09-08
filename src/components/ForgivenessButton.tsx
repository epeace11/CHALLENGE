"use client";
import { useState, useTransition } from "react";
import { requestForgiveness } from "@/app/actions/entries";

export function ForgivenessButton({ pointId }: { pointId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button type="button" className="text-xs font-semibold text-accent underline" onClick={() => setOpen(true)}>
        Request forgiveness
      </button>
    );
  }
  return (
    <div className="mt-1 flex flex-col gap-1.5">
      <textarea className="input text-sm" rows={2} placeholder="What happened? (e.g. football ended at 11:30)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending || !reason.trim()}
          className="btn btn-primary py-1 text-xs"
          onClick={() => {
            setError(null);
            start(async () => {
              const res = await requestForgiveness(pointId, reason);
              if (!res.ok) setError(res.error);
              else setOpen(false);
            });
          }}
        >
          Send request
        </button>
        <button type="button" className="btn btn-ghost py-1 text-xs" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {error && <p className="text-xs text-bad">{error}</p>}
    </div>
  );
}
