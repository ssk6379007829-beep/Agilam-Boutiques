/**
 * Client-side "following" store for boutiques.
 *
 * Buyers browse anonymously (no auth id to key a DB row on), so the boutiques a
 * buyer follows are kept in localStorage under a single key. Both the boutiques
 * directory and the boutique profile read/write through here so a follow on one
 * screen is reflected on the other.
 */

export const FOLLOW_KEY = 'agx:following';

/** Fires when the follow map changes, so open screens can re-read it. */
export const FOLLOW_EVENT = 'agx:following-changed';

export function readFollows(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(FOLLOW_KEY) || '{}') as Record<string, boolean>;
  } catch {
    return {};
  }
}

export function isFollowing(id: string): boolean {
  return !!readFollows()[id];
}

/** Sets the follow state for a boutique and returns the new value. */
export function setFollow(id: string, follow: boolean): boolean {
  const map = readFollows();
  if (follow) map[id] = true;
  else delete map[id];
  try {
    localStorage.setItem(FOLLOW_KEY, JSON.stringify(map));
    window.dispatchEvent(new Event(FOLLOW_EVENT));
  } catch {
    /* storage may be unavailable (private mode) — callers keep their in-memory copy */
  }
  return follow;
}

/** Toggles the follow state for a boutique and returns the new value. */
export function toggleFollow(id: string): boolean {
  return setFollow(id, !isFollowing(id));
}
