import { supabase } from '@/lib/supabase';
import type { Role } from '@/types/database';

export interface AdminUserRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  address: string | null;
  role: Role;
  status: 'active' | 'blocked';
  deleted_at: string | null;
  created_at: string;
  orders: number;
  spent: number;
}

export interface UsersQuery {
  page: number;
  pageSize: number;
  search?: string;
  role?: 'all' | Role;
  status?: 'all' | 'active' | 'blocked' | 'deleted';
}

export interface Paged<T> {
  rows: T[];
  total: number;
}

export async function fetchUsers(q: UsersQuery): Promise<Paged<AdminUserRow>> {
  let query = supabase
    .from('profiles')
    .select('id, full_name, email, phone, city, address, role, status, deleted_at, created_at', { count: 'exact' });

  if (q.role && q.role !== 'all') query = query.eq('role', q.role);
  if (q.status === 'deleted') query = query.not('deleted_at', 'is', null);
  else {
    query = query.is('deleted_at', null);
    if (q.status === 'active' || q.status === 'blocked') query = query.eq('status', q.status);
  }
  if (q.search?.trim()) {
    const s = `%${q.search.trim()}%`;
    query = query.or(`full_name.ilike.${s},email.ilike.${s},phone.ilike.${s},city.ilike.${s}`);
  }

  const from = q.page * q.pageSize;
  query = query.order('created_at', { ascending: false }).range(from, from + q.pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  const rows = (data ?? []) as Omit<AdminUserRow, 'orders' | 'spent'>[];

  const ids = rows.map((r) => r.id);
  const totals = new Map<string, { orders: number; spent: number }>();
  if (ids.length) {
    const { data: ord } = await supabase.from('orders').select('buyer_id, total').in('buyer_id', ids);
    (ord ?? []).forEach((o: { buyer_id: string | null; total: number }) => {
      if (!o.buyer_id) return;
      const current = totals.get(o.buyer_id) ?? { orders: 0, spent: 0 };
      current.orders += 1;
      current.spent += Number(o.total);
      totals.set(o.buyer_id, current);
    });
  }

  return {
    total: count ?? 0,
    rows: rows.map((r) => ({
      ...r,
      orders: totals.get(r.id)?.orders ?? 0,
      spent: totals.get(r.id)?.spent ?? 0,
    })),
  };
}

export async function setUserStatus(id: string, status: 'active' | 'blocked') {
  const { error } = await supabase
    .from('profiles')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function softDeleteUser(id: string) {
  const { error } = await supabase
    .from('profiles')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function restoreUser(id: string) {
  const { error } = await supabase.from('profiles').update({ deleted_at: null }).eq('id', id);
  if (error) throw error;
}

export interface UserDetail {
  orders: {
    id: string;
    order_number: string;
    total: number;
    status: string;
    created_at: string;
    boutique: string;
  }[];
  wishlist: number;
  totalSpent: number;
}

export async function fetchUserDetail(id: string): Promise<UserDetail> {
  const [ordersRes, wishRes] = await Promise.all([
    supabase
      .from('orders')
      .select('id, order_number, total, status, created_at, boutique:boutiques(name)')
      .eq('buyer_id', id)
      .order('created_at', { ascending: false }),
    supabase.from('wishlist').select('product_id', { count: 'exact', head: true }).eq('buyer_id', id),
  ]);

  const orders = (ordersRes.data ?? []) as unknown as {
    id: string;
    order_number: string;
    total: number;
    status: string;
    created_at: string;
    boutique: { name: string } | null;
  }[];

  return {
    orders: orders.map((o) => ({
      id: o.id,
      order_number: o.order_number,
      total: Number(o.total),
      status: o.status,
      created_at: o.created_at,
      boutique: o.boutique?.name ?? '-',
    })),
    wishlist: wishRes.count ?? 0,
    totalSpent: orders.reduce((sum, o) => sum + Number(o.total), 0),
  };
}

export function usersToCsv(rows: AdminUserRow[]): string {
  const head = ['Name', 'Email', 'Phone', 'City', 'Role', 'Status', 'Orders', 'Spent', 'Joined'];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [
      r.full_name,
      r.email,
      r.phone,
      r.city,
      r.role,
      r.deleted_at ? 'deleted' : r.status,
      r.orders,
      r.spent,
      new Date(r.created_at).toLocaleDateString('en-IN'),
    ].map(esc).join(','),
  );
  return [head.join(','), ...lines].join('\n');
}

export interface CreateUserInput {
  email: string;
  fullName: string;
  phone?: string;
  city?: string;
  role: Role;
}

export async function createUser(input: CreateUserInput): Promise<{ userId: string; message: string }> {
  const response = await fetch('/api/admin-create-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to create user');
  }

  return { userId: data.userId, message: data.message };
}

export async function changeUserRole(userId: string, newRole: Role): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ role: newRole, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}

export function storeAdoptedRole(role: Role): void {
  try {
    sessionStorage.setItem('agx-adopted-role', role);
  } catch {
    /* session storage unavailable */
  }
}

export function getAdoptedRole(): Role | null {
  try {
    return (sessionStorage.getItem('agx-adopted-role') as Role) || null;
  } catch {
    return null;
  }
}

export function clearAdoptedRole(): void {
  try {
    sessionStorage.removeItem('agx-adopted-role');
  } catch {
    /* session storage unavailable */
  }
}
