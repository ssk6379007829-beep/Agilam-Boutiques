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

export async function createAd(title: string, placement: string) {
  const { error } = await supabase.from('ads').insert({ title, placement, status: 'draft' });
  if (error) throw error;
}
