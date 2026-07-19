import { supabase } from '@/lib/supabase';
import { fetchOrdersForBuyer } from '@/data/orders';
import { fromBuyerOrder, mergeServerOrders, type BuyerDbOrder } from '@/lib/orderHistory';

/**
 * Cross-device sync for a signed-in buyer.
 *
 * A signed-in buyer has a real account, so everything works through existing
 * RLS from the browser — no service role: their profile lives in `profiles`
 * (self-update policy) and their orders read back via the `buyer_id` policy.
 */

export type LocalProfile = { name: string; phone: string; city: string; address: string };

// Seeded placeholder names AuthContext gives a fresh account — treat as "unset".
const PLACEHOLDER_NAMES = ['New user', 'Customer'];

/**
 * Merge the buyer's account profile with what's in the browser, and pull their
 * orders back.
 *
 * - `local` — details currently in the browser (guest state).
 * - `patch` — an explicit edit the buyer just saved; overrides everything.
 *
 * With no patch this MERGES so nothing is lost: the account (DB) wins where it
 * has a value, otherwise the local value fills it in. So details typed as a
 * guest migrate up to the account on first sign-in, and a later sign-in (even
 * after logout wiped local storage) restores whatever the account holds. The
 * merged result is persisted back to the account and returned for display.
 */
export async function syncAccount(local: LocalProfile, patch?: LocalProfile): Promise<LocalProfile | null> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user?.id;
  if (!uid) throw new Error('Not signed in');

  const { data: prof } = await supabase
    .from('profiles')
    .select('full_name, phone, city, address')
    .eq('id', uid)
    .maybeSingle();

  const dbName = prof?.full_name && !PLACEHOLDER_NAMES.includes(prof.full_name) ? prof.full_name : '';
  const base: LocalProfile = { name: dbName, phone: prof?.phone ?? '', city: prof?.city ?? '', address: prof?.address ?? '' };

  // Explicit edit overrides; otherwise fill the account's blanks from local.
  const next: LocalProfile = patch
    ? { name: patch.name, phone: patch.phone, city: patch.city, address: patch.address }
    : {
        name: base.name || local.name,
        phone: base.phone || local.phone,
        city: base.city || local.city,
        address: base.address || local.address,
      };

  // Persist only when it actually changes what the account holds.
  const changed = next.name !== base.name || next.phone !== base.phone || next.city !== base.city || next.address !== base.address;
  if (changed) {
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: next.name, phone: next.phone || null, city: next.city || null, address: next.address || null })
      .eq('id', uid);
    if (error) throw error;
  }

  // Merge the buyer's real orders into local history.
  const orders = await fetchOrdersForBuyer(uid);
  mergeServerOrders(orders.map((o) => fromBuyerOrder(o as unknown as BuyerDbOrder)));

  return next;
}
