'use client';
import { useEffect, useState } from 'react';
import { Maximize2, X } from 'lucide-react';
import { useChallenge } from '@/components/app/challenge-context';
import { proofPaths } from '@/lib/checkin';
import { formatPhotoDate } from '@/lib/dates';
import { PROOF_BUCKET } from '@/lib/proof';
import { supabase } from '@/lib/supabase';
import { ProofViewer } from './proof-viewer';

/** Signed links last an hour; the list re-signs a little before that, so a view left open keeps its images. */
const SIGNED_FOR = 3600,
  RESIGN_AFTER = 50 * 60 * 1000;

/**
 * Every screenshot on an answer (newline-separated paths) as a row of thumbnails with their photo
 * dates, signed in one request. Tapping one opens all of them in the viewer at that one; while
 * editing, each has a remove control.
 */
export function Proofs({
  proof,
  onRemove,
}: {
  proof: string | null | undefined;
  /** Called with the paths that remain. */
  onRemove?: (paths: string[]) => void;
}) {
  const { data } = useChallenge();
  const paths = proofPaths(proof),
    key = paths.join('\n');
  const [urls, setUrls] = useState<Record<string, string>>({}),
    [open, setOpen] = useState<number | null>(null);
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
  const taken = (p: string) =>
    data.photos.find((x) => x.path === p)?.taken_at ?? null;
  const shots = paths.map((p) => {
    const t = taken(p);
    return {
      url: urls[p],
      date: t ? `Photo taken ${formatPhotoDate(t)}` : 'No photo date',
    };
  });
  return (
    <div className="proof-strip">
      {paths.map((p, i) => {
        const t = taken(p);
        return (
          <figure key={p} className="proof-thumb">
            <button
              type="button"
              className="proof-open"
              aria-label={`View screenshot ${i + 1} of ${paths.length}`}
              onClick={() => setOpen(i)}
            >
              {urls[p] ? (
                <img src={urls[p]} alt="" draggable={false} />
              ) : (
                <span className="proof-placeholder" />
              )}
              <Maximize2 className="proof-expand" size={13} />
            </button>
            <figcaption title={shots[i].date}>
              {t ? formatPhotoDate(t, true) : 'No date'}
            </figcaption>
            {onRemove && (
              <button
                type="button"
                className="proof-remove"
                aria-label={`Remove screenshot ${i + 1}`}
                title="Remove this screenshot"
                onClick={() => onRemove(paths.filter((x) => x !== p))}
              >
                <X size={14} strokeWidth={2.6} />
              </button>
            )}
          </figure>
        );
      })}
      <ProofViewer
        shots={shots}
        index={open}
        onIndex={setOpen}
        onClose={() => setOpen(null)}
      />
    </div>
  );
}
