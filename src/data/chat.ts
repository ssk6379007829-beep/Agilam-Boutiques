import { supabase } from '@/lib/supabase';
import { readGuest } from '@/lib/buyerDetails';
import type { ConversationWithPeer, MessageRow } from './types';

/**
 * Return the current signed-in user's id, or null. Used by read-only surfaces
 * (the buyer inbox) so merely opening Messages never mints a throwaway account.
 */
export async function getBuyerId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/**
 * Give the anonymous buyer a durable identity so their side of the chat is a
 * real, RLS-satisfying participant. Buyers never sign up (they browse the public
 * surface), so the first time one actually opens a conversation we create an
 * anonymous Supabase auth user + matching buyer profile, seeded with the name +
 * phone they gave at the details gate. The session persists in localStorage, so
 * a returning buyer keeps the same threads. Requires "Anonymous sign-ins" to be
 * enabled in the Supabase project's Auth settings.
 */
export async function ensureBuyerIdentity(): Promise<string> {
  let uid = await getBuyerId();
  if (!uid) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    uid = data.user?.id ?? null;
    if (!uid) throw new Error('Could not start a chat session');
  }
  const guest = readGuest();
  const name = guest.name.trim() || 'Customer';
  const phone = guest.phone.trim() || null;
  // Ensure a profile row exists so conversations.buyer_id / messages.sender_id
  // resolve, and the seller sees a real name/number instead of a bare id.
  // upsert/ignoreDuplicates: AuthContext's onAuthStateChange also creates the
  // profile when the anonymous session lands, so tolerate the race.
  await supabase
    .from('profiles')
    .upsert({ id: uid, role: 'buyer', full_name: name, phone }, { onConflict: 'id', ignoreDuplicates: true });
  return uid;
}

/**
 * Push the buyer's latest saved name/phone onto their profile. Called after the
 * details gate so a returning buyer who updates their info is reflected to the
 * boutique (the initial upsert above ignores conflicts, so it won't overwrite).
 */
export async function syncBuyerProfile(): Promise<void> {
  const uid = await getBuyerId();
  if (!uid) return;
  const guest = readGuest();
  if (!guest.name.trim()) return;
  await supabase
    .from('profiles')
    .update({ full_name: guest.name.trim(), phone: guest.phone.trim() || null })
    .eq('id', uid);
}

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

// Friendly one-line preview for the inbox: product-card messages carry an
// encoded body, so surface the product name instead of the raw marker/JSON.
function previewText(body: string): string {
  const card = parseProductCard(body);
  return card ? `🛍️ ${card.title}` : body;
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
        last_message: last ? previewText(last.body) : 'Say hello 👋',
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

/**
 * Product context shared into a conversation. When a buyer starts a chat from a
 * product page we post one of these as a normal message, encoded with a marker
 * so both the buyer's and the seller's ChatView render it as a product card —
 * that way the seller immediately sees which product the enquiry is about.
 */
export type ProductCard = { id: string; title: string; price: number; image?: string; tone: number; cat?: string };

const PRODUCT_MARKER = '@@PRODUCT@@';

export function encodeProductCard(p: ProductCard): string {
  return PRODUCT_MARKER + JSON.stringify(p);
}

export function parseProductCard(body: string): ProductCard | null {
  if (!body.startsWith(PRODUCT_MARKER)) return null;
  try {
    return JSON.parse(body.slice(PRODUCT_MARKER.length)) as ProductCard;
  } catch {
    return null;
  }
}

/**
 * Order context shared into a conversation. When a buyer taps "Chat with
 * boutique" from an order we post one of these, so the seller immediately sees
 * which order the enquiry is about (rendered as an order card, same idea as the
 * product card above).
 */
export type OrderCard = { orderId: string; title: string; image?: string; tone: number; qty?: number; amount?: number; status?: string };

const ORDER_MARKER = '@@ORDER@@';

export function encodeOrderCard(o: OrderCard): string {
  return ORDER_MARKER + JSON.stringify(o);
}

export function parseOrderCard(body: string): OrderCard | null {
  if (!body.startsWith(ORDER_MARKER)) return null;
  try {
    return JSON.parse(body.slice(ORDER_MARKER.length)) as OrderCard;
  } catch {
    return null;
  }
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
