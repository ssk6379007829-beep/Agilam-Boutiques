import { useCallback, useEffect, useRef, useState } from 'react';
import { canRefreshNow, onRevalidate } from '@/lib/liveRefresh';

export type AsyncOptions = {
  /**
   * Minimum age of the current data before a background refresh is worth a
   * request. The shared scheduler invites us to refresh more often than this;
   * anything younger is simply skipped.
   */
  staleMs?: number;
  /** Set false for data that never changes underneath the user (or is costly). */
  live?: boolean;
};

const DEFAULT_STALE_MS = 60_000;

/**
 * Cheap structural comparison used to decide whether new data is worth
 * re-rendering for. Supabase hands back fresh object identities on every fetch,
 * so without this every poll would re-render every list in the app — remounting
 * images, dropping hover states, and interrupting the user for no reason.
 *
 * Rows are plain JSON, so stringify is both accurate and fast enough here.
 */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Loads async data and then quietly keeps it current.
 *
 * The first load (and any change to `deps`) is a foreground load: `loading`
 * goes true and the screen shows its skeleton. Everything after that is a
 * background revalidation — `loading` stays false, the previous data stays on
 * screen, and if the result is identical to what's already rendered the
 * component doesn't re-render at all. The user sees an update only when there
 * genuinely is one.
 *
 * Timing (tab visible, online, not typing, not mid-checkout) is decided by
 * `@/lib/liveRefresh`; this hook only decides whether its own data is stale.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], options: AsyncOptions = {}) {
  const { staleMs = DEFAULT_STALE_MS, live = true } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** True during a background refresh — for a subtle indicator, never a skeleton. */
  const [refreshing, setRefreshing] = useState(false);

  // The latest fetcher, so the shared scheduler always calls the current
  // closure without the effect having to re-subscribe on every render.
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const dataRef = useRef<T | null>(null);
  const fetchedAt = useRef(0);
  // Bumped by every foreground load; a result from an earlier generation (a
  // slow response landing after the deps changed) is dropped rather than
  // painted over the newer data.
  const generation = useRef(0);
  const inFlight = useRef(false);

  const run = useCallback(async (background: boolean) => {
    // Never stack background polls; a foreground load always wins, because its
    // deps are newer than whatever is in flight.
    if (background && inFlight.current) return;
    const gen = generation.current;
    inFlight.current = true;

    if (background) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fnRef.current();
      if (gen !== generation.current) return;
      fetchedAt.current = Date.now();
      // Re-render only when something actually changed.
      if (!background || !same(dataRef.current, res)) {
        dataRef.current = res;
        setData(res);
      }
      setError(null);
    } catch (e) {
      if (gen !== generation.current) return;
      // A failed background refresh keeps the last good data on screen and says
      // nothing: the user is looking at a working page, and a transient network
      // blip is not their problem. Only a foreground failure surfaces an error.
      if (!background) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (gen === generation.current) {
        inFlight.current = false;
        if (background) setRefreshing(false);
        else setLoading(false);
      }
    }
  }, []);

  // Foreground load on mount and whenever the inputs change.
  useEffect(() => {
    generation.current += 1;
    void run(false);
    return () => {
      // Invalidate anything still in flight for the outgoing deps.
      generation.current += 1;
      inFlight.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // Background revalidation, driven by the app-wide scheduler.
  useEffect(() => {
    if (!live) return;
    return onRevalidate(() => {
      if (Date.now() - fetchedAt.current < staleMs) return;
      void run(true);
    });
  }, [live, staleMs, run]);

  /**
   * Refetch now — used after a mutation. Silent once there is something on
   * screen, so saving an edit updates the list in place instead of collapsing
   * it back to a skeleton.
   */
  const reload = useCallback(() => {
    void run(dataRef.current !== null);
  }, [run]);

  /** Refetch in the background, but only if this is a good moment to. */
  const refresh = useCallback(() => {
    if (!canRefreshNow()) return;
    void run(true);
  }, [run]);

  return { data, loading, error, reload, refresh, refreshing };
}
