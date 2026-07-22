/**
 * Per-device persistence for Inspire feed interactions.
 *
 * Buyers browse anonymously, so a like or a save has to survive a refresh
 * without an account — same local-first arrangement as the bag and wishlist
 * (`@/lib/buyerLocal`). On sign-in, saves merge up into the account and the DB
 * becomes the source of truth.
 *
 * Likes are also kept here for a second reason: the shared counter is moved by
 * an RPC that a guest can call, so the client is the only thing stopping a
 * double-tap from counting twice. This record is that guard.
 */

const LIKE_KEY = 'agx-post-likes';
const SAVE_KEY = 'agx-post-saves';

type Flags = Record<string, boolean>;

function read(key: string): Flags {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (!parsed || typeof parsed !== 'object') return {};
    const clean: Flags = {};
    for (const [id, on] of Object.entries(parsed as Flags)) if (on === true) clean[id] = true;
    return clean;
  } catch {
    return {};
  }
}

function write(key: string, value: Flags): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode) — in-memory state still holds */
  }
}

export const readLocalPostLikes = (): Flags => read(LIKE_KEY);
export const writeLocalPostLikes = (likes: Flags): void => write(LIKE_KEY, likes);

export const readLocalPostSaves = (): Flags => read(SAVE_KEY);
export const writeLocalPostSaves = (saves: Flags): void => write(SAVE_KEY, saves);

/** Called on logout so one account's feed activity doesn't leak to the next. */
export function clearLocalFeedInteractions(): void {
  try {
    localStorage.removeItem(LIKE_KEY);
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
