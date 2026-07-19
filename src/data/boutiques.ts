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
