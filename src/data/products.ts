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
  let query = supabase.from('products').select(SELECT);

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
  const { data, error } = await supabase.from('products').select(SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return data as unknown as ProductWithBoutique | null;
}

export async function fetchFeaturedProducts(): Promise<ProductWithBoutique[]> {
  const { data, error } = await supabase.from('products').select(SELECT).eq('featured', true).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ProductWithBoutique[];
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
}) {
  const { error } = await supabase.from('products').insert(input);
  if (error) throw error;
}

export async function updateProduct(id: string, patch: Partial<{ title: string; price: number; stock: number; category: string }>) {
  const { error } = await supabase.from('products').update(patch).eq('id', id);
  if (error) throw error;
}
