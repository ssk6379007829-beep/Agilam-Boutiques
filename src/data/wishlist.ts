import { supabase } from '@/lib/supabase';
import type { ProductWithBoutique } from './types';

export async function fetchWishlist(buyerId: string): Promise<ProductWithBoutique[]> {
  const { data, error } = await supabase
    .from('wishlist')
    .select('product:products(*, boutique:boutiques(name, city, tone))')
    .eq('buyer_id', buyerId);
  if (error) throw error;
  return ((data ?? []) as unknown as { product: ProductWithBoutique }[]).map((r) => r.product).filter(Boolean);
}

export async function fetchWishlistIds(buyerId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from('wishlist').select('product_id').eq('buyer_id', buyerId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.product_id));
}

export async function toggleWishlist(buyerId: string, productId: string, isWished: boolean) {
  if (isWished) {
    const { error } = await supabase.from('wishlist').delete().eq('buyer_id', buyerId).eq('product_id', productId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('wishlist').insert({ buyer_id: buyerId, product_id: productId });
    if (error) throw error;
  }
}
