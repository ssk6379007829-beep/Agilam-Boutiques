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

/** A UUID that works even outside a secure context. `crypto.randomUUID` is only
 *  available over HTTPS/localhost, so a seller opening the app on a LAN IP
 *  (e.g. their phone at http://192.168.x.x) would otherwise crash the upload. */
function randomId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  if (c?.getRandomValues) {
    const b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map((x) => x.toString(16).padStart(2, '0'));
    return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10).join('')}`;
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Uploads a product photo to the public `product-images` bucket, scoped under
 *  the boutique's id so storage RLS can verify ownership from the path alone. */
export async function uploadProductImage(boutiqueId: string, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file (JPG or PNG)');
  if (file.size > 10 * 1024 * 1024) throw new Error('Image is too large — please use one under 10 MB');

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${boutiqueId}/${randomId()}.${ext}`;
  const { error } = await supabase.storage
    .from('product-images')
    .upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) {
    // Surface the underlying cause instead of a generic failure so setup issues
    // (missing bucket / RLS from migration 0008) are diagnosable in the toast.
    if (/bucket.*not found/i.test(error.message)) {
      throw new Error('Photo storage is not set up yet (apply migration 0008 in Supabase)');
    }
    throw new Error(error.message || 'Photo upload failed');
  }
  const { data } = supabase.storage.from('product-images').getPublicUrl(path);
  return data.publicUrl;
}
