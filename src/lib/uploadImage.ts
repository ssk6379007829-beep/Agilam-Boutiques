import { supabase } from '@/lib/supabase';

/** A UUID that works even outside a secure context. `crypto.randomUUID` is only
 *  available over HTTPS/localhost, so a seller opening the app on a LAN IP
 *  (e.g. their phone at http://192.168.x.x) would otherwise crash the upload. */
export function randomId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  if (c?.getRandomValues) {
    const b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map((x) => x.toString(16).padStart(2, '0'));
    return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10).join('')}`;
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Uploads a file to a public Supabase Storage bucket and returns its public URL.
 * The shared core behind {@link uploadImage} and {@link uploadAudio}: a session
 * check (RLS is gated on `to authenticated`), a secure-context-safe filename and
 * diagnosable setup errors. Callers own the type/size validation and the noun
 * ("Photo" / "Audio") used in the error copy.
 */
async function uploadToBucket(
  bucket: string,
  folder: string,
  file: File,
  migrationHint: string,
  noun: string,
  fallbackExt: string,
): Promise<string> {
  // An RLS denial on upload is almost always a missing/expired session, since the
  // storage policy is gated on `to authenticated`. Check first so the seller gets
  // "sign in again" instead of an opaque row-level-security error.
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) throw new Error(`Your session expired — please sign in again to upload ${noun.toLowerCase()}`);

  const ext = (file.name.split('.').pop() || fallbackExt).toLowerCase().replace(/[^a-z0-9]/g, '') || fallbackExt;
  const path = `${folder}/${randomId()}.${ext}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) {
    // Surface the underlying cause instead of a generic failure so setup issues
    // (missing bucket / missing storage RLS policy) are diagnosable from the toast.
    if (/bucket.*not found/i.test(error.message)) {
      throw new Error(`${noun} storage is not set up yet (apply migration ${migrationHint} in Supabase)`);
    }
    if (/row-level security|violates|unauthorized/i.test(error.message)) {
      throw new Error(`Storage upload blocked by RLS — apply migration ${migrationHint} in Supabase`);
    }
    throw new Error(error.message || `${noun} upload failed`);
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Uploads an image to a public Supabase Storage bucket and returns its public URL.
 * Shared by product photos and boutique branding so both get the same validation,
 * secure-context-safe filenames and diagnosable errors.
 */
export async function uploadImage(
  bucket: string,
  folder: string,
  file: File,
  migrationHint: string,
): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file (JPG or PNG)');
  if (file.size > 10 * 1024 * 1024) throw new Error('Image is too large — please use one under 10 MB');
  return uploadToBucket(bucket, folder, file, migrationHint, 'Photo', 'jpg');
}
