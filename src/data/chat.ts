import { supabase } from '@/lib/supabase';
import type { ConversationWithPeer, MessageRow } from './types';

export async function fetchConversationsForBuyer(buyerId: string): Promise<ConversationWithPeer[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, buyer_id, boutique_id, created_at, boutique:boutiques(name, tone), messages(body, created_at, sender_id)')
    .eq('buyer_id', buyerId);
  if (error) throw error;
  return shapeConversations(data ?? [], buyerId, 'buyer');
}

export async function fetchConversationsForBoutique(boutiqueId: string): Promise<ConversationWithPeer[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, buyer_id, boutique_id, created_at, buyer:profiles!conversations_buyer_id_fkey(full_name), messages(body, created_at, sender_id)')
    .eq('boutique_id', boutiqueId);
  if (error) throw error;
  return shapeConversations(data ?? [], boutiqueId, 'seller');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shapeConversations(rows: any[], viewerId: string, mode: 'buyer' | 'seller'): ConversationWithPeer[] {
  return rows
    .map((r) => {
      const msgs = (r.messages ?? []) as { body: string; created_at: string; sender_id: string }[];
      const last = [...msgs].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      const unread = msgs.filter((m) => m.sender_id !== viewerId).length > 0 && last && last.sender_id !== viewerId ? 1 : 0;
      return {
        id: r.id,
        buyer_id: r.buyer_id,
        boutique_id: r.boutique_id,
        created_at: r.created_at,
        buyer_name: mode === 'seller' ? r.buyer?.full_name ?? 'Customer' : '',
        boutique_name: mode === 'buyer' ? r.boutique?.name ?? 'Boutique' : '',
        boutique_tone: r.boutique?.tone ?? 0,
        last_message: last?.body ?? 'Say hello 👋',
        last_message_at: last?.created_at ?? null,
        unread,
      } as ConversationWithPeer;
    })
    .sort((a, b) => (b.last_message_at ?? b.created_at).localeCompare(a.last_message_at ?? a.created_at));
}

export async function fetchConversationPeerName(conversationId: string, viewerRole: 'buyer' | 'seller'): Promise<string> {
  if (viewerRole === 'buyer') {
    const { data } = await supabase.from('conversations').select('boutique:boutiques(name)').eq('id', conversationId).maybeSingle();
    return (data as unknown as { boutique: { name: string } } | null)?.boutique?.name ?? 'Boutique';
  }
  const { data } = await supabase.from('conversations').select('buyer:profiles!conversations_buyer_id_fkey(full_name)').eq('id', conversationId).maybeSingle();
  return (data as unknown as { buyer: { full_name: string } } | null)?.buyer?.full_name ?? 'Customer';
}

export async function getOrCreateConversation(buyerId: string, boutiqueId: string): Promise<string> {
  const { data: existing } = await supabase.from('conversations').select('id').eq('buyer_id', buyerId).eq('boutique_id', boutiqueId).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await supabase.from('conversations').insert({ buyer_id: buyerId, boutique_id: boutiqueId }).select('id').single();
  if (error) throw error;
  return data.id;
}

export async function fetchMessages(conversationId: string): Promise<MessageRow[]> {
  const { data, error } = await supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as MessageRow[];
}

export async function sendMessage(conversationId: string, senderId: string, body: string) {
  const { error } = await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: senderId, body });
  if (error) throw error;
}

export function subscribeToMessages(conversationId: string, onInsert: (msg: MessageRow) => void) {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => onInsert(payload.new as MessageRow),
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
