"use client";
import { useState, useTransition } from "react";
import { approveEntry, concedeDispute, decideForgiveness, disputeEntry, withdrawDispute } from "@/app/actions/entries";

type Props =
  | { kind: "entry"; entryId: string }
  | { kind: "forgiveness"; requestId: string }
  | { kind: "dispute"; disputeId: string; role: "logger" | "disputer" };

export function ReviewActions(props: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [showDispute, setShowDispute] = useState(false);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong");
    });
  };

  if (props.kind === "entry") {
    return (
      <div className="mt-2">
        {!showDispute ? (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={pending} className="btn btn-good" onClick={() => run(() => approveEntry(props.entryId))}>👍 Approve</button>
            <button type="button" disabled={pending} className="btn btn-ghost" onClick={() => setShowDispute(true)}>🤨 Dispute</button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <textarea className="input text-sm" rows={2} placeholder="Why are you disputing this? (required)" value={comment} onChange={(e) => setComment(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={pending || !comment.trim()} className="btn btn-bad" onClick={() => run(() => disputeEntry(props.entryId, comment))}>Submit dispute</button>
              <button type="button" disabled={pending} className="btn btn-ghost" onClick={() => setShowDispute(false)}>Cancel</button>
            </div>
          </div>
        )}
        {error && <p className="mt-1 text-xs text-bad">{error}</p>}
      </div>
    );
  }

  if (props.kind === "forgiveness") {
    return (
      <div className="mt-2">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={pending} className="btn btn-good" onClick={() => run(() => decideForgiveness(props.requestId, true))}>🛡️ Forgive</button>
          <button type="button" disabled={pending} className="btn btn-ghost" onClick={() => run(() => decideForgiveness(props.requestId, false))}>Deny</button>
        </div>
        {error && <p className="mt-1 text-xs text-bad">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-2">
      {props.role === "logger" ? (
        <button type="button" disabled={pending} className="btn btn-bad w-full" onClick={() => run(() => concedeDispute(props.disputeId))}>
          I concede (take the point)
        </button>
      ) : (
        <button type="button" disabled={pending} className="btn btn-ghost w-full" onClick={() => run(() => withdrawDispute(props.disputeId))}>
          Withdraw my dispute
        </button>
      )}
      {error && <p className="mt-1 text-xs text-bad">{error}</p>}
    </div>
  );
}
