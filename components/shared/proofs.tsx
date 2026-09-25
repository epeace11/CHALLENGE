'use client';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useChallenge } from '@/components/app/challenge-context';
import { supabase } from '@/lib/supabase';
import { PROOF_BUCKET, proofPaths } from '@/lib/proof';

/** Signed links last an hour; the list re-signs a little before that, so a dialog left open keeps its images. */
const SIGNED_FOR = 3600,
  RESIGN_AFTER = 50 * 60 * 1000;

/** One screenshot: a thumbnail that opens a lightbox, with its photo date, and a remove control while editing. */
function Proof({
  url,
  taken,
  onRemove,
  removeDisabled = false,
}: {
  url: string | undefined;
  taken: string | null;
  onRemove?: () => void;
  removeDisabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const date = taken ? `Photo date: ${taken}` : 'No photo date available';
  if (!url) return <p className="muted">Loading screenshot…</p>;
  return (
    <div className="proof-item">
      <button type="button" className="proof" onClick={() => setOpen(true)}>
        <img src={url} alt="Attached proof screenshot" />
        <span>
          View screenshot<small className="photo-date">{date}</small>
        </span>
      </button>
      {onRemove && (
        <button
          type="button"
          className="proof-remove"
          aria-label="Remove this screenshot"
          title={
            removeDisabled
              ? 'Add another screenshot before removing the only one'
              : 'Remove this screenshot'
          }
          disabled={removeDisabled}
          onClick={onRemove}
        >
          <X size={15} />
        </button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="lightbox">
          <DialogTitle>Screenshot</DialogTitle>
          <DialogDescription>{date}</DialogDescription>
          <img src={url} alt="Proof screenshot, enlarged" />
          <a className="text-link" href={url} target="_blank" rel="noreferrer">
            Open original ↗
          </a>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Every screenshot attached to an answer (newline-separated paths), signed in one request, each with its own lightbox and, while editing, a remove control. */
export function Proofs({
  proof,
  onRemove,
  keepOne = false,
}: {
  proof: string | null | undefined;
  /** Called with the paths that remain. */
  onRemove?: (paths: string[]) => void;
  /** Disallow removing the last screenshot. */
  keepOne?: boolean;
}) {
  const { data } = useChallenge();
  const paths = proofPaths(proof),
    key = paths.join('\n');
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!key) return;
    let live = true,
      timer: ReturnType<typeof setTimeout> | undefined;
    const sign = async () => {
      const { data: signed } = await supabase.storage
        .from(PROOF_BUCKET)
        .createSignedUrls(key.split('\n'), SIGNED_FOR);
      if (!live) return;
      setUrls(
        Object.fromEntries(
          (signed ?? [])
            .filter((s) => s.path && s.signedUrl)
            .map((s) => [s.path, s.signedUrl]),
        ),
      );
      timer = setTimeout(() => void sign(), RESIGN_AFTER);
    };
    void sign();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [key]);
  if (!paths.length) return null;
  return (
    <div className="proof-list">
      {paths.map((p) => (
        <Proof
          key={p}
          url={urls[p]}
          taken={data.photos.find((x) => x.path === p)?.taken_at ?? null}
          onRemove={
            onRemove ? () => onRemove(paths.filter((x) => x !== p)) : undefined
          }
          removeDisabled={keepOne && paths.length === 1}
        />
      ))}
    </div>
  );
}
