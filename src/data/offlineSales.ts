import { supabase } from '@/lib/supabase';

export type OfflineSaleItem = {
  product_id: string | null;
  title: string;
  price: number;
  qty: number;
};

export type OfflineSaleResult = {
  id: string;
  order_number: string;
  total: number;
  created_at: string;
};

/** Records a walk-in (in-person, non-app) sale via the `create_offline_sale`
 *  RPC — one atomic call that writes the order + items and decrements stock,
 *  so a partial failure can't desync inventory from the bill. */
export async function createOfflineSale(input: {
  boutique_id: string;
  buyer_name: string;
  buyer_phone: string;
  items: OfflineSaleItem[];
  discount?: number;
  payment_method?: string;
}): Promise<OfflineSaleResult> {
  const { data, error } = await supabase.rpc('create_offline_sale', {
    p_boutique_id: input.boutique_id,
    p_buyer_name: input.buyer_name,
    p_buyer_phone: input.buyer_phone,
    p_items: input.items,
    p_discount: input.discount ?? 0,
    p_payment_method: input.payment_method ?? 'Cash',
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Could not create the bill');
  return row as OfflineSaleResult;
}
