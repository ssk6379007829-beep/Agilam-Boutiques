import { supabase } from '@/lib/supabase';
import type { ProductWithBoutique } from './types';

export type ProductFilters = {
  maxPrice?: number;
  categories?: string[];
  colors?: string[];
  occasions?: string[];
  sort?: 'Latest' | 'Price: Low to High' | 'Price: High to Low' | 'Popularity';
};

const SELECT = '*, boutique:boutiques(name, city, tone)';

export async function fetchProducts(filters: ProductFilters = {}): Promise<ProductWithBoutique[]> {
  // Only surface live products to buyers — admin moderation (hidden/rejected)
  // and soft-deletes drop out of discovery. Existing rows default to 'active'.
  let query = supabase.from('products').select(SELECT).eq('status', 'active').is('deleted_at', null);

  if (filters.maxPrice != null) query = query.lte('price', filters.maxPrice);
  if (filters.categories?.length) query = query.in('category', filters.categories);
  if (filters.colors?.length) query = query.in('color', filters.colors);
  if (filters.occasions?.length) query = query.in('occasion', filters.occasions);

  if (filters.sort === 'Price: Low to High') query = query.order('price', { ascending: true });
  else if (filters.sort === 'Price: High to Low') query = query.order('price', { ascending: false });
  else if (filters.sort === 'Popularity') query = query.order('reviews_count', { ascending: false });
  else query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as ProductWithBoutique[];
}

export async function fetchProduct(id: string): Promise<ProductWithBoutique | null> {
  const { data, error } = await supabase
    .from('products')
    .select(SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as ProductWithBoutique | null;
}

export async function fetchProductsByBoutique(boutiqueId: string): Promise<ProductWithBoutique[]> {
  const { data, error } = await supabase.from('products').select(SELECT).eq('boutique_id', boutiqueId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ProductWithBoutique[];
}

export async function createProduct(input: {
  boutique_id: string;
  title: string;
  category: string;
  price: number;
  stock: number;
  fabric?: string;
  color?: string;
  occasion?: string;
  tone?: number;
  description?: string;
  mrp?: number | null;
  sizes?: string[];
  wash_care?: string;
  image_url?: string;
  images?: string[];
}) {
  const { error } = await supabase.from('products').insert(input);
  if (error) throw error;
}

export async function updateProduct(
  id: string,
  patch: Partial<{
    title: string;
    price: number;
    stock: number;
    category: string;
    color: string;
    occasion: string;
    fabric: string;
    description: string;
    mrp: number | null;
    sizes: string[];
    wash_care: string;
    image_url: string;
    images: string[];
  }>,
) {
  const { error } = await supabase.from('products').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteProduct(id: string) {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}

/** Uploads a product photo to the public `product-images` bucket, scoped under
 *  the boutique's id so storage RLS can verify ownership from the path alone. */
export async function uploadProductImage(boutiqueId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${boutiqueId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('product-images').getPublicUrl(path);
  return data.publicUrl;
}
