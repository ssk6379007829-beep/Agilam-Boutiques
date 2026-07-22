/**
 * The app-wide "is now a good moment to refresh?" scheduler.
 *
 * Every screen that reads from Supabase should show what the site actually
 * contains right now — a seller marking an order shipped, an admin approving a
 * boutique, a piece going out of stock. The rule that matters more than
 * freshness, though, is that a refresh must never take the screen away from the
 * person using it. So this module owns the *timing* policy and nothing else:
 *
 *   - one shared interval for the whole app, not one per hook, so twenty
 *     `useAsync` call sites cost one timer and fire in the same tick;
 *   - nothing fires while the tab is hidden or the device is offline — a phone
 *     in a pocket does no polling and burns no battery;
 *   - nothing fires while a field is focused, so a half-typed address or search
 *     box is never pulled out from under the user;
 *   - screens in the middle of something irreversible (checkout, payment, the
 *     onboarding wizard) pause it outright — see `pauseLiveRefresh`.
 *
 * Consumers get told "now would be fine"; deciding whether their own data is
 * stale enough to be worth a request is up to them (see `useAsync`).
 */

type Listener = () => void;

/** How often we consider revalidating. Individual hooks throttle further. */
const TICK_MS = 45_000;

const listeners = new Set<Listener>();
let pauses = 0;
let timer: ReturnType<typeof setInterval> | undefined;
let wired = false;

const canUseDom = typeof window !== 'undefined' && typeof document !== 'undefined';

/**
 * True while the user is typing. Refetching under a focused field is the single
 * most disruptive thing background refresh can do — it can re-render a list out
 * from under a tap, or reset a controlled input mid-word.
 */
function isEditing(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
}

/** Whether a background refresh would be unobtrusive right this moment. */
export function canRefreshNow(): boolean {
  if (!canUseDom) return false;
  if (pauses > 0) return false;
  if (document.visibilityState !== 'visible') return false;
  if (navigator.onLine === false) return false;
  if (isEditing()) return false;
  return true;
}

function emit() {
  if (!canRefreshNow()) return;
  // A copy, so a listener that unsubscribes during the sweep can't corrupt it.
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch {
      // A failing screen must not stop the rest of the app from refreshing.
    }
  }
}

function wire() {
  if (wired || !canUseDom) return;
  wired = true;

  // Coming back to the tab is the moment freshness matters most: whatever
  // happened while you were away should already be on screen when you look.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') emit();
  });
  window.addEventListener('focus', emit);
  // Reconnecting after a tunnel or a lift — catch up on what was missed.
  window.addEventListener('online', emit);
  // pageshow fires on back/forward-cache restores, where the DOM can be minutes
  // or hours old and no other event says so.
  window.addEventListener('pageshow', emit);
}

function start() {
  wire();
  if (timer === undefined) timer = setInterval(emit, TICK_MS);
}

function stop() {
  if (timer !== undefined && listeners.size === 0) {
    clearInterval(timer);
    timer = undefined;
  }
}

/**
 * Registers a callback to be invited to revalidate. Returns an unsubscribe.
 * The callback is only ever called at moments that pass `canRefreshNow`.
 */
export function onRevalidate(listener: Listener): () => void {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
    stop();
  };
}

/**
 * Suspends every background refresh in the app until the returned function is
 * called. Nested pauses are counted, so two screens can pause independently.
 *
 * Used by flows where a re-render is worse than stale data: money is moving,
 * a long form is half-filled, or a third-party widget (Razorpay) owns the page.
 */
export function pauseLiveRefresh(): () => void {
  pauses += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    pauses = Math.max(0, pauses - 1);
  };
}
