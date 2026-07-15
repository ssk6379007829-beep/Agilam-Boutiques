import { supabase } from '@/lib/supabase';

export interface NotificationRow {
  id: string;
  profile_id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

export async function fetchNotifications(profileId: string): Promise<NotificationRow[]> {
  const { data, error } = await supabase.from('notifications').select('*').eq('profile_id', profileId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as NotificationRow[];
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
  if (error) throw error;
}

export async function createNotification(input: { profile_id: string; type: string; title: string; body: string }) {
  const { error } = await supabase.from('notifications').insert(input);
  if (error) throw error;
}
