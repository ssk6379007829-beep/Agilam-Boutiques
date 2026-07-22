/**
 * Per-device persistence for Inspire feed likes.
 *
 * Buyers browse anonymously, so a like has to survive a refresh without an
 * account — the same local-first arrangement as the bag and wishlist
 * (`@/lib/buyerLocal`). Saving a piece isn't here: that's the wishlist, which
 * already persists and syncs through `ShopContext`.
 *
 * Likes are kept locally for a second reason too. The shared counter is moved by
 * an RPC that a guest can call, so the client is the only thing stopping a
 * double-tap from counting twice. This record is that guard.
 */

const LIKE_KEY = 'agx-product-likes';

type Flags = Record<string, boolean>;

export function readLocalLikes(): Flags {
  try {
    const raw = localStorage.getItem(LIKE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (!parsed || typeof parsed !== 'object') return {};
    const clean: Flags = {};
    for (const [id, on] of Object.entries(parsed as Flags)) if (on === true) clean[id] = true;
    return clean;
  } catch {
    return {};
  }
}

export function writeLocalLikes(likes: Flags): void {
  try {
    localStorage.setItem(LIKE_KEY, JSON.stringify(likes));
  } catch {
    /* storage unavailable (private mode) — in-memory state still holds */
  }
}

/** Called on logout so one account's hearts don't greet the next person. */
export function clearLocalFeedInteractions(): void {
  try {
    localStorage.removeItem(LIKE_KEY);
  } catch {
    /* ignore */
  }
}
