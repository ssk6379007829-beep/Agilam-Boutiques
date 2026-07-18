import { supabase } from '@/lib/supabase';
import type { BoutiqueRow } from './types';

export async function fetchApprovedBoutiques(): Promise<BoutiqueRow[]> {
  const { data, error } = await supabase.from('boutiques').select('*').eq('status', 'approved').order('rating', { ascending: false });
  if (error) throw error;
  return (data ?? []) as BoutiqueRow[];
}

export async function fetchBoutique(id: string): Promise<BoutiqueRow | null> {
  const { data, error } = await supabase.from('boutiques').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as BoutiqueRow | null;
}

export async function fetchMyBoutique(ownerId: string): Promise<BoutiqueRow | null> {
  const { data, error } = await supabase.from('boutiques').select('*').eq('owner_id', ownerId).maybeSingle();
  if (error) throw error;
  return data as BoutiqueRow | null;
}

export async function updateBoutique(id: string, patch: Partial<{ name: string; city: string; description: string }>) {
  const { error } = await supabase.from('boutiques').update(patch).eq('id', id);
  if (error) throw error;
}

export interface AdminBoutiqueRow extends BoutiqueRow {
  owner: { full_name: string } | null;
}

export async function fetchAllBoutiquesAdmin(): Promise<AdminBoutiqueRow[]> {
  const { data, error } = await supabase
    .from('boutiques')
    .select('*, owner:profiles!boutiques_owner_id_fkey(full_name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as AdminBoutiqueRow[];
}

export async function setBoutiqueStatus(id: string, status: 'approved' | 'rejected') {
  const { error } = await supabase.from('boutiques').update({ status, verified: status === 'approved' }).eq('id', id);
  if (error) throw error;
}

export async function setBoutiqueFeatured(id: string, featured: boolean) {
  const { error } = await supabase.from('boutiques').update({ featured }).eq('id', id);
  if (error) throw error;
}
