import { supabase } from '@/lib/supabase';
import { uploadImage } from '@/lib/uploadImage';
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

/**
 * Move a boutique's shared follower count up (follow) or down (unfollow) and
 * return the new total. Backed by a SECURITY DEFINER RPC so anonymous buyers
 * can update the count past RLS. The client guards against double-counting per
 * device via local storage.
 */
export async function followBoutique(id: string, follow: boolean): Promise<number> {
  const { data, error } = await supabase.rpc('toggle_boutique_follow', { bid: id, do_follow: follow });
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}

/** Live-subscribe to a boutique's follower count; returns an unsubscribe fn. */
export function subscribeToBoutiqueFollowers(id: string, onChange: (count: number) => void) {
  const channel = supabase
    .channel(`boutique-followers:${id}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'boutiques', filter: `id=eq.${id}` },
      (payload) => {
        const row = payload.new as { followers_count?: number };
        if (typeof row.followers_count === 'number') onChange(row.followers_count);
      },
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export async function fetchMyBoutique(ownerId: string): Promise<BoutiqueRow | null> {
  const { data, error } = await supabase.from('boutiques').select('*').eq('owner_id', ownerId).maybeSingle();
  if (error) throw error;
  return data as BoutiqueRow | null;
}

/** Create the signed-in seller's boutique (used in Google onboarding). */
export async function createMyBoutique(ownerId: string, input: { name: string; city: string }): Promise<BoutiqueRow> {
  const { data, error } = await supabase
    .from('boutiques')
    .insert({ owner_id: ownerId, name: input.name, city: input.city, tone: Math.floor(Math.random() * 8) })
    .select('*')
    .single();
  if (error) throw error;
  return data as BoutiqueRow;
}

export type BoutiquePatch = Partial<{
  name: string;
  city: string;
  area: string;
  description: string;
  phone: string | null;
  instagram: string | null;
  cover_url: string | null;
  logo_url: string | null;
}>;

export async function updateBoutique(id: string, patch: BoutiquePatch) {
  const { error } = await supabase.from('boutiques').update(patch).eq('id', id);
  if (error) throw error;
}

/** Uploads a boutique logo/cover to the public `boutique-images` bucket. */
export async function uploadBoutiqueImage(boutiqueId: string, kind: 'logo' | 'cover', file: File): Promise<string> {
  return uploadImage('boutique-images', `${boutiqueId}/${kind}`, file, '0019');
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

export async function setBoutiqueStatus(id: string, status: 'pending' | 'approved' | 'rejected') {
  const { error } = await supabase.from('boutiques').update({ status, verified: status === 'approved' }).eq('id', id);
  if (error) throw error;
}

/** Toggle whether a boutique is featured across the marketplace. Admin-only via RLS. */
export async function setBoutiqueFeatured(id: string, featured: boolean) {
  const { error } = await supabase.from('boutiques').update({ featured }).eq('id', id);
  if (error) throw error;
}
