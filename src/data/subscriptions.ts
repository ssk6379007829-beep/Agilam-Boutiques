import { supabase } from '@/lib/supabase';
import type { SubPlan, SubStatus } from '@/types/database';

export interface SubscriptionRow {
  id: string;
  boutique_id: string;
  plan: SubPlan;
  status: SubStatus;
  price: number;
  renewal_date: string | null;
  created_at: string;
}

export interface SubscriptionWithBoutique extends SubscriptionRow {
  boutique: { name: string } | null;
}

export async function fetchSubscriptionForBoutique(boutiqueId: string): Promise<SubscriptionRow | null> {
  const { data, error } = await supabase.from('subscriptions').select('*').eq('boutique_id', boutiqueId).maybeSingle();
  if (error) throw error;
  return data as SubscriptionRow | null;
}

export async function fetchAllSubscriptionsAdmin(): Promise<SubscriptionWithBoutique[]> {
  const { data, error } = await supabase.from('subscriptions').select('*, boutique:boutiques(name)').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as SubscriptionWithBoutique[];
}

export async function upgradeToFeatured(boutiqueId: string) {
  const { error } = await supabase.from('subscriptions').update({ plan: 'featured', price: 799 }).eq('boutique_id', boutiqueId);
  if (error) throw error;
  await supabase.from('boutiques').update({ featured: true }).eq('id', boutiqueId);
}
