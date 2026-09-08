import type { PhotoWithUrl } from "@/lib/types";
import { formatInstant } from "@/lib/scoring";

export function PhotoStrip({ photos, tz, size = "h-24 w-24" }: { photos: PhotoWithUrl[]; tz: string; size?: string }) {
  if (!photos.length) return null;
  return (
    <div className="mt-2 flex gap-2 overflow-x-auto">
      {photos.map((p) => (
        <div key={p.id} className="shrink-0">
          {p.url ? (
            <a href={p.url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="proof" className={`${size} rounded-lg object-cover`} />
            </a>
          ) : (
            <div className={`${size} rounded-lg bg-line`} />
          )}
          <div className="mt-0.5 text-[10px] text-muted">
            {p.taken_at ? `📸 ${formatInstant(p.taken_at, tz)}` : "no EXIF date"}
          </div>
        </div>
      ))}
    </div>
  );
}
