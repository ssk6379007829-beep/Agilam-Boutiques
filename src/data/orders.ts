import { supabase } from '@/lib/supabase';
import type { OrderWithDetails } from './types';

const SELECT = `id, order_number, buyer_id, boutique_id, status, total, created_at, guest_name, guest_phone, guest_city, buyer:profiles!orders_buyer_id_fkey(full_name, phone, city), boutique:boutiques(name, tone), items:order_items(id, title, price, qty, size, color)`;

export async function fetchOrdersForBuyer(buyerId: string): Promise<OrderWithDetails[]> {
  const { data, error } = await supabase.from('orders').select(SELECT).eq('buyer_id', buyerId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as OrderWithDetails[];
}

export async function fetchOrdersForBoutique(boutiqueId: string): Promise<OrderWithDetails[]> {
  const { data, error } = await supabase.from('orders').select(SELECT).eq('boutique_id', boutiqueId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as OrderWithDetails[];
}

export async function fetchAllOrdersAdmin(): Promise<OrderWithDetails[]> {
  const { data, error } = await supabase.from('orders').select(SELECT).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as OrderWithDetails[];
}

export async function fetchOrder(id: string): Promise<OrderWithDetails | null> {
  const { data, error } = await supabase.from('orders').select(SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return data as unknown as OrderWithDetails | null;
}

export async function updateOrderStatus(id: string, status: 'pending' | 'shipped' | 'delivered' | 'rejected') {
  const { error } = await supabase.from('orders').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function createOrder(input: {
  buyer_id: string;
  boutique_id: string;
  total: number;
  items: { product_id?: string; title: string; price: number; qty: number; size?: string; color?: string }[];
}) {
  const order_number = 'AGL-' + Math.floor(1000 + Math.random() * 9000);
  const { data, error } = await supabase
    .from('orders')
    .insert({ order_number, buyer_id: input.buyer_id, boutique_id: input.boutique_id, total: input.total })
    .select()
    .single();
  if (error) throw error;
  const { error: itemsError } = await supabase.from('order_items').insert(input.items.map((it) => ({ ...it, order_id: data.id })));
  if (itemsError) throw itemsError;
  return data;
}

export interface CustomerStat {
  buyer_id: string;
  name: string;
  city: string | null;
  orders: number;
  spent: number;
  tone: number;
}

const CUSTOMER_SELECT = 'buyer_id, total, guest_name, guest_phone, guest_city, buyer:profiles!orders_buyer_id_fkey(full_name, city)';

type CustomerRow = {
  buyer_id: string | null;
  total: number;
  guest_name: string | null;
  guest_phone: string | null;
  guest_city: string | null;
  buyer: { full_name: string; city: string | null } | null;
};

export async function fetchCustomersForBoutique(boutiqueId: string): Promise<CustomerStat[]> {
  const { data, error } = await supabase.from('orders').select(CUSTOMER_SELECT).eq('boutique_id', boutiqueId);
  if (error) throw error;
  return aggregateCustomers((data ?? []) as unknown as CustomerRow[]);
}

export async function fetchCustomersAdmin(): Promise<CustomerStat[]> {
  const { data, error } = await supabase.from('orders').select(CUSTOMER_SELECT);
  if (error) throw error;
  return aggregateCustomers((data ?? []) as unknown as CustomerRow[]);
}

function aggregateCustomers(rows: CustomerRow[]): CustomerStat[] {
  const map = new Map<string, CustomerStat>();
  rows.forEach((r, i) => {
    // Registered buyers group by id; anonymous guests by phone (falling back to
    // name) so two different guests aren't merged under a null buyer_id.
    const key = r.buyer_id ?? `guest:${r.guest_phone ?? r.guest_name ?? i}`;
    const existing = map.get(key);
    if (existing) {
      existing.orders += 1;
      existing.spent += Number(r.total);
    } else {
      map.set(key, {
        buyer_id: key,
        name: r.buyer?.full_name ?? r.guest_name ?? 'Customer',
        city: r.buyer?.city ?? r.guest_city ?? null,
        orders: 1,
        spent: Number(r.total),
        tone: i % 8,
      });
    }
  });
  return [...map.values()].sort((a, b) => b.spent - a.spent);
}
