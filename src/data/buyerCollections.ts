import { supabase } from '@/lib/supabase';
import type { Cart } from '@/state/ShopContext';

/**
 * Account-backed buyer collections: bag (cart_items), saved items (wishlist)
 * and followed boutiques (boutique_followers).
 *
 * A signed-in buyer has a real auth id, so every call here works through the
 * per-owner RLS policies from the browser — no service role. The ShopContext
 * loads all three on sign-in, write-through mutates on every change, and merges
 * a guest's local collections up on first sign-in.
 */

export type BuyerCollections = {
  cart: Cart;
  wishlist: Record<string, boolean>;
  follows: Record<string, boolean>;
};

/** Load the buyer's full set of collections from the account in one shot. */
export async function loadCollections(buyerId: string): Promise<BuyerCollections> {
  const [cartRes, wishRes, followRes] = await Promise.all([
    supabase.from('cart_items').select('product_id, qty, size').eq('buyer_id', buyerId),
    supabase.from('wishlist').select('product_id').eq('buyer_id', buyerId),
    supabase.from('boutique_followers').select('boutique_id').eq('buyer_id', buyerId),
  ]);
  if (cartRes.error) throw cartRes.error;
  if (wishRes.error) throw wishRes.error;
  if (followRes.error) throw followRes.error;

  const cart: Cart = {};
  for (const r of cartRes.data ?? []) cart[r.product_id] = { qty: r.qty, size: r.size };

  const wishlist: Record<string, boolean> = {};
  for (const r of wishRes.data ?? []) wishlist[r.product_id] = true;

  const follows: Record<string, boolean> = {};
  for (const r of followRes.data ?? []) follows[r.boutique_id] = true;

  return { cart, wishlist, follows };
}

// ── Cart mutations (write-through) ────────────────────────────────────────
export async function dbUpsertCartItem(buyerId: string, productId: string, qty: number, size: string) {
  const { error } = await supabase
    .from('cart_items')
    .upsert({ buyer_id: buyerId, product_id: productId, qty, size, updated_at: new Date().toISOString() }, { onConflict: 'buyer_id,product_id' });
  if (error) throw error;
}

export async function dbRemoveCartItem(buyerId: string, productId: string) {
  const { error } = await supabase.from('cart_items').delete().eq('buyer_id', buyerId).eq('product_id', productId);
  if (error) throw error;
}

export async function dbClearCart(buyerId: string) {
  const { error } = await supabase.from('cart_items').delete().eq('buyer_id', buyerId);
  if (error) throw error;
}

// ── Wishlist mutations ────────────────────────────────────────────────────
export async function dbAddWishlist(buyerId: string, productId: string) {
  const { error } = await supabase
    .from('wishlist')
    .upsert({ buyer_id: buyerId, product_id: productId }, { onConflict: 'buyer_id,product_id', ignoreDuplicates: true });
  if (error) throw error;
}

export async function dbRemoveWishlist(buyerId: string, productId: string) {
  const { error } = await supabase.from('wishlist').delete().eq('buyer_id', buyerId).eq('product_id', productId);
  if (error) throw error;
}

// ── Follow mutations ──────────────────────────────────────────────────────
export async function dbAddFollow(buyerId: string, boutiqueId: string) {
  const { error } = await supabase
    .from('boutique_followers')
    .upsert({ buyer_id: buyerId, boutique_id: boutiqueId }, { onConflict: 'buyer_id,boutique_id', ignoreDuplicates: true });
  if (error) throw error;
}

export async function dbRemoveFollow(buyerId: string, boutiqueId: string) {
  const { error } = await supabase.from('boutique_followers').delete().eq('buyer_id', buyerId).eq('boutique_id', boutiqueId);
  if (error) throw error;
}

/**
 * Merge a guest's local collections up into the account on first sign-in.
 *
 * Union semantics, DB wins on conflict: existing account rows are kept
 * (`ignoreDuplicates`), and anything the buyer built while browsing as a guest
 * is added on top. Follows inserted here fire the followers-count trigger, so
 * the guest's device-local follows finally count once they have an account.
 */
export async function mergeGuestCollections(buyerId: string, local: BuyerCollections): Promise<void> {
  const cartRows = Object.entries(local.cart).map(([product_id, line]) => ({
    buyer_id: buyerId,
    product_id,
    qty: line.qty,
    size: line.size,
  }));
  const wishRows = Object.keys(local.wishlist)
    .filter((id) => local.wishlist[id])
    .map((product_id) => ({ buyer_id: buyerId, product_id }));
  const followRows = Object.keys(local.follows)
    .filter((id) => local.follows[id])
    .map((boutique_id) => ({ buyer_id: buyerId, boutique_id }));

  const ops: PromiseLike<unknown>[] = [];
  if (cartRows.length)
    ops.push(supabase.from('cart_items').upsert(cartRows, { onConflict: 'buyer_id,product_id', ignoreDuplicates: true }));
  if (wishRows.length)
    ops.push(supabase.from('wishlist').upsert(wishRows, { onConflict: 'buyer_id,product_id', ignoreDuplicates: true }));
  if (followRows.length)
    ops.push(supabase.from('boutique_followers').upsert(followRows, { onConflict: 'buyer_id,boutique_id', ignoreDuplicates: true }));

  if (ops.length) await Promise.all(ops);
}
