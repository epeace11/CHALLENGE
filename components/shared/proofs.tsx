'use client';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { PROOF_BUCKET, proofPaths } from '@/lib/proof';

/** One screenshot: a thumbnail that opens a lightbox, with its photo date, and a remove control while editing. */
function Proof({
  path,
  onRemove,
  removeDisabled = false,
}: {
  path: string;
  onRemove?: () => void;
  removeDisabled?: boolean;
}) {
  const [url, setUrl] = useState(''),
    [taken, setTaken] = useState<string | null>(null),
    [open, setOpen] = useState(false);
  useEffect(() => {
    let live = true;
    void supabase
      .from('challenge_photos')
      .select('taken_at')
      .eq('path', path)
      .maybeSingle()
      .then(({ data }) => {
        if (live) setTaken(data?.taken_at ?? null);
      });
    void supabase.storage
      .from(PROOF_BUCKET)
      .createSignedUrl(path, 600)
      .then(({ data }) => {
        if (live) setUrl(data?.signedUrl ?? '');
      });
    return () => {
      live = false;
    };
  }, [path]);
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

/** Every screenshot attached to an answer (newline-separated paths), each with its own lightbox and, while editing, a remove control. */
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
  const paths = proofPaths(proof);
  if (!paths.length) return null;
  return (
    <div className="proof-list">
      {paths.map((p) => (
        <Proof
          key={p}
          path={p}
          onRemove={
            onRemove ? () => onRemove(paths.filter((x) => x !== p)) : undefined
          }
          removeDisabled={keepOne && paths.length === 1}
        />
      ))}
    </div>
  );
}
