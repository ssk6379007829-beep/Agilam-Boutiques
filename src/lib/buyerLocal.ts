import type { Cart } from '@/state/ShopContext';

/**
 * Local (per-device) persistence for a buyer's collections — bag, saved items
 * and followed boutiques.
 *
 * These power two things:
 *  1. Guests (not signed in) keep their bag/wishlist/follows across refreshes.
 *  2. On the first sign-in, whatever the guest built here is MERGED up into the
 *     account (see src/data/buyerCollections.ts) and then this local copy is
 *     cleared — from then on the account (DB) is the source of truth.
 *
 * The follow key matches the legacy `agx:following` store so a buyer's existing
 * local follows carry over into the account on first sign-in.
 */

const CART_KEY = 'agx-cart';
const WISH_KEY = 'agx-wishlist';
const FOLLOW_KEY = 'agx:following';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode) — in-memory state still holds */
  }
}

export function readLocalCart(): Cart {
  const raw = read<Record<string, { qty: number; size: string }>>(CART_KEY, {});
  // Guard against malformed entries from older/hand-edited storage.
  const clean: Cart = {};
  for (const [id, line] of Object.entries(raw)) {
    if (line && typeof line.qty === 'number' && line.qty > 0) {
      clean[id] = { qty: line.qty, size: typeof line.size === 'string' ? line.size : 'M' };
    }
  }
  return clean;
}

export function writeLocalCart(cart: Cart): void {
  write(CART_KEY, cart);
}

export function readLocalWishlist(): Record<string, boolean> {
  return read<Record<string, boolean>>(WISH_KEY, {});
}

export function writeLocalWishlist(wishlist: Record<string, boolean>): void {
  write(WISH_KEY, wishlist);
}

export function readLocalFollows(): Record<string, boolean> {
  return read<Record<string, boolean>>(FOLLOW_KEY, {});
}

export function writeLocalFollows(follows: Record<string, boolean>): void {
  write(FOLLOW_KEY, follows);
}

/** Wipe the local copies — called after a successful merge into the account and
 * on logout, so collections never leak between accounts on a shared device. */
export function clearLocalCollections(): void {
  try {
    localStorage.removeItem(CART_KEY);
    localStorage.removeItem(WISH_KEY);
    localStorage.removeItem(FOLLOW_KEY);
  } catch {
    /* ignore */
  }
}
