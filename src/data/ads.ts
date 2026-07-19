import { supabase } from '@/lib/supabase';
import type { AdStatus } from '@/types/database';

export interface AdRow {
  id: string;
  title: string;
  placement: string;
  status: AdStatus;
  impressions: number;
  clicks: number;
  created_at: string;
}

export async function fetchAds(): Promise<AdRow[]> {
  const { data, error } = await supabase.from('ads').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AdRow[];
}

export async function createAd(title: string, placement: string, status: AdStatus = 'draft'): Promise<AdRow> {
  const { data, error } = await supabase.from('ads').insert({ title, placement, status }).select('*').single();
  if (error) throw error;
  return data as AdRow;
}

/** Edit a campaign's editable fields (title, placement, status). Admin-only via RLS. */
export async function updateAd(id: string, patch: Partial<Pick<AdRow, 'title' | 'placement' | 'status'>>) {
  const { error } = await supabase.from('ads').update(patch).eq('id', id);
  if (error) throw error;
}

export async function setAdStatus(id: string, status: AdStatus) {
  const { error } = await supabase.from('ads').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function deleteAd(id: string) {
  const { error } = await supabase.from('ads').delete().eq('id', id);
  if (error) throw error;
}
