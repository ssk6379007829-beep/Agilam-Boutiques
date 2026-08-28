import { supabase } from '@/lib/supabase';
import { uploadImage } from '@/lib/uploadImage';
import type { ProductSpec, ProductWithBoutique } from './types';

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
  // No status filter here on purpose: this is dual-use (buyer PDP + the seller's
  // own ProductAnalytics), and hiding a moderation-hidden product from anonymous
  // buyers while still letting its owner see it is enforced by RLS (migration
  // 0034), not by a query filter that would blind the seller to their own item.
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
  /** Packed weight of one unit in grams (migration 0065). Null falls back to
   *  the boutique default when a parcel is booked. */
  weight_grams?: number | null;
  sizes?: string[];
  wash_care?: string;
  image_url?: string;
  images?: string[];
  // PDP detail sections (migration 0054).
  badges?: string[];
  feeding_friendly?: boolean;
  feeding_note?: string;
  shipping_info?: string;
  color_disclaimer?: string;
  specs?: ProductSpec[];
  // Colour sets and per-size stock (migration 0103). `size_stock` null keeps
  // the sizes on the pooled `stock`; when it is set the database derives
  // `stock` from it, so the number passed above is only a fallback.
  variant_group_id?: string | null;
  size_stock?: Record<string, number> | null;
}) {
  const { error } = await supabase.from('products').insert(input);
  if (error) throw error;
}

/**
 * Publish several products in one statement — a piece and its other colours,
 * written together from the Add page.
 *
 * One multi-row INSERT rather than a loop on purpose: Postgres runs it as a
 * single statement, so either every colour is listed or none is. A loop that
 * failed on the third colour would leave two half of a set live, with the
 * seller's photos already uploaded and no way to tell what went in.
 */
export async function createProducts(inputs: Parameters<typeof createProduct>[0][]) {
  if (inputs.length === 0) return;
  const { error } = await supabase.from('products').insert(inputs);
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
    weight_grams: number | null;
    sizes: string[];
    wash_care: string;
    image_url: string;
    images: string[];
    badges: string[];
    feeding_friendly: boolean;
    feeding_note: string;
    shipping_info: string;
    color_disclaimer: string;
    specs: ProductSpec[];
    variant_group_id: string | null;
    size_stock: Record<string, number> | null;
  }>,
) {
  const { error } = await supabase.from('products').update(patch).eq('id', id);
  if (error) throw error;
}

/** One other colour of the same piece, as the seller's colour-set panel and the
 *  buyer's product page render it. Each is a full product in its own right —
 *  this is only the slice both screens need to draw a swatch. */
export type ColourSibling = {
  id: string;
  slug?: string | null;
  title: string;
  color: string | null;
  image_url: string | null;
  price: number;
  mrp: number | null;
  stock: number;
};

const SIBLING_COLS = 'id, slug, title, color, image_url, price, mrp, stock';

/**
 * The other colours of a piece (migration 0103). Returns the whole set in
 * listing order — the caller drops the one it is already showing, because the
 * seller's panel and the buyer's strip disagree about whether the current
 * colour belongs in the row.
 *
 * Soft-deleted rows are excluded; moderation-hidden ones are not, so a seller
 * still sees their own set intact while RLS keeps buyers from reading them.
 */
export async function fetchColourSet(groupId: string): Promise<ColourSibling[]> {
  const { data, error } = await supabase
    .from('products')
    .select(SIBLING_COLS)
    .eq('variant_group_id', groupId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ColourSibling[];
}

/**
 * The seller's own products that could join a colour set — anything in the shop
 * that isn't already in one, so linking can never quietly pull a product out of
 * another set it belongs to. Used by the "Link an existing product" picker.
 */
export async function fetchColourSetCandidates(boutiqueId: string, excludeId: string): Promise<ColourSibling[]> {
  const { data, error } = await supabase
    .from('products')
    .select(SIBLING_COLS)
    .eq('boutique_id', boutiqueId)
    .neq('id', excludeId)
    .is('variant_group_id', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) throw error;
  return (data ?? []) as unknown as ColourSibling[];
}

export async function deleteProduct(id: string) {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}

/** Uploads a product photo to the public `product-images` bucket, scoped under
 *  the boutique's id so photos stay grouped per shop.
 *
 *  `title` is the piece's own title where the caller knows it, so the stored
 *  file is `mangaimart-kanchipuram-silk-saree-<id>.jpg` rather than a bare
 *  UUID. It is optional because the ad composers upload a banner before any
 *  product exists to name it after. */
export async function uploadProductImage(boutiqueId: string, file: File, title?: string): Promise<string> {
  return uploadImage('product-images', boutiqueId, file, '0017', title);
}

/**
 * Record that a buyer opened this product page. The seller reads the resulting
 * `views_count`/`last_viewed_at` off their own catalogue row. Best-effort — a
 * failed view must never break browsing — and throttled once per product per
 * browser session so a re-render or a back-and-forth doesn't inflate it.
 * (RPC + counter columns land in migration 0031.)
 */
const VIEWED_KEY = 'agx.viewed';
export async function recordProductView(productId: string): Promise<void> {
  try {
    const seen = new Set<string>(JSON.parse(sessionStorage.getItem(VIEWED_KEY) ?? '[]'));
    if (seen.has(productId)) return;
    seen.add(productId);
    sessionStorage.setItem(VIEWED_KEY, JSON.stringify([...seen]));
  } catch {
    /* private mode / no sessionStorage — fall through and still record once */
  }
  await supabase.rpc('record_product_view', { pid: productId });
}

/** Record that a buyer shared this product. Best-effort. */
export async function recordProductShare(productId: string): Promise<void> {
  await supabase.rpc('record_product_share', { pid: productId });
}
