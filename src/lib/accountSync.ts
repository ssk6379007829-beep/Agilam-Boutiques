import { supabase } from '@/lib/supabase';
import { fetchOrdersForBuyer } from '@/data/orders';
import { fromBuyerOrder, mergeServerOrders, type BuyerDbOrder } from '@/lib/orderHistory';

/**
 * Cross-device sync for a signed-in buyer.
 *
 * A signed-in buyer has a real account, so everything works through existing
 * RLS from the browser — no service role needed: their profile lives in the
 * `profiles` table (self-update policy) and their orders read back via the
 * `buyer_id` policy. The uid is read from the live session so this is safe to
 * call right after sign-in, before the auth context state has caught up.
 */

export type AccountProfile = { full_name: string; phone: string | null; city: string | null };

export async function syncAccount(patch?: { name?: string; phone?: string; city?: string }): Promise<AccountProfile | null> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user?.id;
  if (!uid) throw new Error('Not signed in');

  // Push any edited fields to the buyer's profile row.
  const update: Record<string, string> = {};
  if (patch?.name != null) update.full_name = patch.name;
  if (patch?.phone != null) update.phone = patch.phone;
  if (patch?.city != null) update.city = patch.city;
  if (Object.keys(update).length) {
    const { error } = await supabase.from('profiles').update(update).eq('id', uid);
    if (error) throw error;
  }

  // Pull the saved profile back (source of truth across devices).
  const { data: prof } = await supabase.from('profiles').select('full_name, phone, city').eq('id', uid).maybeSingle();

  // Merge the buyer's real orders into local history.
  const orders = await fetchOrdersForBuyer(uid);
  mergeServerOrders(orders.map((o) => fromBuyerOrder(o as unknown as BuyerDbOrder)));

  return (prof as AccountProfile) ?? null;
}
