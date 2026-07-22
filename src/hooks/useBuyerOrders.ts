import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { onRevalidate } from '@/lib/liveRefresh';
import { fetchOrdersForBuyer, subscribeToBuyerOrders } from '@/data/orders';
import {
  fromBuyerOrder,
  mergeServerOrders,
  readOrders,
  type BuyerDbOrder,
  type PlacedOrder,
} from '@/lib/orderHistory';

/**
 * The buyer's orders, kept current.
 *
 * Two sources have to be reconciled. Guests check out anonymously, so RLS can
 * never hand their orders back — the local mirror written at checkout is all
 * there is. A signed-in buyer's orders *are* readable, and the boutique moves
 * them through the fulfilment stages afterwards, so the server copy is the
 * authoritative status.
 *
 * This merges the two (server wins on conflict), refreshes on mount, and
 * subscribes to status changes so a "shipped" or "delivered" update lands on
 * the buyer's screen without a reload. Both the order list and the tracking
 * screen use it, so they can never disagree about an order's state.
 */
export function useBuyerOrders() {
  const [orders, setOrders] = useState<PlacedOrder[]>(() => readOrders());
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `readOrders` rebuilds the array on every call, so committing it unchecked
  // would re-render the orders list on every poll. Only publish real changes.
  const publish = useCallback((next: PlacedOrder[]) => {
    setOrders((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, []);

  /**
   * `silent` polls without lighting up the Refresh button — the difference
   * between the user asking for an update and us taking one on their behalf.
   * (An options object, not a boolean, so passing this straight to `onClick`
   * can't mistake a MouseEvent for a request to go silent.)
   */
  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id;
    // A guest has nothing to pull — the local mirror is already the truth.
    if (!uid) {
      publish(readOrders());
      return;
    }
    if (!silent) setRefreshing(true);
    setError(null);
    try {
      const rows = await fetchOrdersForBuyer(uid);
      mergeServerOrders(rows.map((o) => fromBuyerOrder(o as unknown as BuyerDbOrder)));
      publish(readOrders());
    } catch {
      // Offline, or RLS hasn't caught up with a fresh sign-in. The locally
      // stored orders still render; just say the status might be stale — and
      // only when they asked, since a silent poll failing is not their problem.
      if (!silent) setError("Couldn't refresh from your account — showing your saved orders.");
      publish(readOrders());
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, [publish]);

  useEffect(() => {
    let active = true;
    void refresh();

    let unsubscribe: (() => void) | undefined;
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id;
      if (!uid || !active) return;
      // Silent: a status change the boutique made should just appear, without
      // the buyer's Refresh button blinking as if they'd pressed it.
      unsubscribe = subscribeToBuyerOrders(uid, () => { void refresh({ silent: true }); });
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [refresh]);

  // Belt and braces on top of the realtime subscription: a socket that dropped
  // while the phone was asleep reconnects silently and misses the "shipped"
  // event, so poll on the app-wide schedule too. `refresh` is idempotent and
  // only commits a change, so a no-op poll costs the screen nothing.
  useEffect(() => onRevalidate(() => { void refresh({ silent: true }); }), [refresh]);

  return { orders, refresh, refreshing, error };
}
