import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
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

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id;
    // A guest has nothing to pull — the local mirror is already the truth.
    if (!uid) {
      setOrders(readOrders());
      return;
    }
    setRefreshing(true);
    setError(null);
    try {
      const rows = await fetchOrdersForBuyer(uid);
      mergeServerOrders(rows.map((o) => fromBuyerOrder(o as unknown as BuyerDbOrder)));
      setOrders(readOrders());
    } catch {
      // Offline, or RLS hasn't caught up with a fresh sign-in. The locally
      // stored orders still render; just say the status might be stale.
      setError("Couldn't refresh from your account — showing your saved orders.");
      setOrders(readOrders());
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void refresh();

    let unsubscribe: (() => void) | undefined;
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id;
      if (!uid || !active) return;
      unsubscribe = subscribeToBuyerOrders(uid, () => { void refresh(); });
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [refresh]);

  return { orders, refresh, refreshing, error };
}
