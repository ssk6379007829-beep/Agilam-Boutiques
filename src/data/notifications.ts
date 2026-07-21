import { supabase } from '@/lib/supabase';

export interface NotificationRow {
  id: string;
  profile_id: string;
  type: string;
  title: string;
  body: string;
  /** Set on order notifications so the row can deep-link to /seller/orders/:id. */
  order_id: string | null;
  read: boolean;
  created_at: string;
}

export async function fetchNotifications(profileId: string): Promise<NotificationRow[]> {
  const { data, error } = await supabase.from('notifications').select('*').eq('profile_id', profileId).order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []) as NotificationRow[];
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
  if (error) throw error;
}

/** Unread count for the bell badge — a HEAD query, so no rows travel. */
export async function countUnreadNotifications(profileId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .eq('read', false);
  if (error) throw error;
  return count ?? 0;
}

export async function createNotification(input: { profile_id: string; type: string; title: string; body: string }) {
  const { error } = await supabase.from('notifications').insert(input);
  if (error) throw error;
}
