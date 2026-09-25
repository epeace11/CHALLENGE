import { parse as parseExif } from 'exifr';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';

export const PROOF_BUCKET = 'challenge-proof';
/** The database refuses more than this many screenshots on one answer. */
export const MAX_PROOFS = 6;

/** Storage paths of every screenshot on an entry: the proof column holds them newline-separated. */
export const proofPaths = (proof: string | null | undefined) =>
  proof ? proof.split('\n').filter(Boolean) : [];
export const joinProofs = (paths: string[]) =>
  paths.length ? paths.join('\n') : null;

/** Scales a screenshot down to 1600 px on its long side and re-encodes it as JPEG. */
async function compress(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw Error('Choose a JPEG, PNG, or WebP screenshot.');
  if (file.size > 20 * 1024 * 1024)
    throw Error('Choose an image smaller than 20 MB.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(Error('Could not prepare the image.'))),
      'image/jpeg',
      0.8,
    ),
  );
}

/** Uploads one screenshot to the member's folder, recording its EXIF date first. Returns its storage path. */
export async function uploadProof(userId: string, file: File) {
  const exif = await parseExif(file, ['DateTimeOriginal']).catch(() => null);
  const taken =
    exif?.DateTimeOriginal instanceof Date
      ? exif.DateTimeOriginal.toISOString()
      : null;
  const blob = await compress(file);
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from(PROOF_BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  await api.addPhoto(path, taken);
  return path;
}
