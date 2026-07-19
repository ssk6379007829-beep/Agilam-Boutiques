import { supabase } from '@/lib/supabase';
import { fmtInr } from '@/lib/tokens';
import type { OrderStatus } from '@/types/database';

const COMMISSION_RATE = 0.08;

export interface OverviewMetrics {
  gmv: number;
  activeBoutiques: number;
  ordersThisMonth: number;
  platformRevenue: number;
}

export async function fetchOverviewMetrics(): Promise<OverviewMetrics> {
  const [{ count: activeBoutiques }, { data: orders }] = await Promise.all([
    supabase.from('boutiques').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
    supabase.from('orders').select('total, created_at'),
  ]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const rows = orders ?? [];
  const gmv = rows.reduce((sum, o) => sum + Number(o.total), 0);
  const ordersThisMonth = rows.filter((o) => new Date(o.created_at) >= monthStart).length;

  return { gmv, activeBoutiques: activeBoutiques ?? 0, ordersThisMonth, platformRevenue: gmv * COMMISSION_RATE };
}

export async function fetchGmvBars(): Promise<string[]> {
  const { data: orders } = await supabase.from('orders').select('total, created_at');
  const rows = orders ?? [];
  const weeks: number[] = new Array(12).fill(0);
  const now = new Date();
  rows.forEach((o) => {
    const weeksAgo = Math.floor((now.getTime() - new Date(o.created_at).getTime()) / (7 * 24 * 3600 * 1000));
    if (weeksAgo >= 0 && weeksAgo < 12) weeks[11 - weeksAgo] += Number(o.total);
  });
  const max = Math.max(...weeks, 1);
  return weeks.map((w) => `${Math.max(6, Math.round((w / max) * 100))}%`);
}

export interface CategoryStat {
  name: string;
  pct: number;
}

export async function fetchCategoryStats(): Promise<CategoryStat[]> {
  const { data } = await supabase.from('products').select('category');
  const rows = data ?? [];
  const counts = new Map<string, number>();
  rows.forEach((r) => counts.set(r.category, (counts.get(r.category) ?? 0) + 1));
  const total = rows.length || 1;
  return [...counts.entries()]
    .map(([name, count]) => ({ name, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 6);
}

export interface CityStat {
  d: string;
  h: string;
}

export async function fetchRevenueByCity(): Promise<CityStat[]> {
  const { data } = await supabase.from('orders').select('total, boutique:boutiques(city)');
  const rows = (data ?? []) as unknown as { total: number; boutique: { city: string } | null }[];
  const byCity = new Map<string, number>();
  rows.forEach((r) => {
    const city = r.boutique?.city ?? 'Other';
    byCity.set(city, (byCity.get(city) ?? 0) + Number(r.total));
  });
  const entries = [...byCity.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = Math.max(...entries.map((e) => e[1]), 1);
  return entries.map(([d, v]) => ({ d, h: `${Math.max(6, Math.round((v / max) * 100))}%` }));
}

export interface PaymentRow {
  id: string;
  txn: string;
  name: string;
  amount: string;
  commission: string;
  /** Derived settlement label (Settled once the order is shipped/delivered). */
  status: string;
  /** Underlying order status the admin can manage. */
  orderStatus: OrderStatus;
}

export async function fetchPayments(): Promise<PaymentRow[]> {
  const { data } = await supabase
    .from('orders')
    .select('id, total, status, boutique:boutiques(name)')
    .order('created_at', { ascending: false })
    .limit(20);
  const rows = (data ?? []) as unknown as { id: string; total: number; status: OrderStatus; boutique: { name: string } | null }[];
  return rows.map((r) => ({
    id: r.id,
    txn: '#TXN-' + r.id.slice(0, 6).toUpperCase(),
    name: r.boutique?.name ?? 'Boutique',
    amount: fmtInr(Number(r.total)),
    commission: fmtInr(Number(r.total) * COMMISSION_RATE),
    status: r.status === 'delivered' || r.status === 'shipped' ? 'Settled' : 'Pending',
    orderStatus: r.status,
  }));
}
