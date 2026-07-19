/**
 * The buyer's own order history, persisted to localStorage.
 *
 * Buyers browse and check out anonymously (no account), so the orders they
 * place can't be read back from Supabase — RLS only exposes an order to its
 * `buyer_id`, and guest orders leave that null (see supabase/schema.sql and
 * api/place-order.js). We therefore mirror each successfully-placed order into
 * localStorage at checkout time, which is the source of truth for the buyer's
 * "My orders" and order-tracking screens. It's captured from the cart the buyer
 * just paid for, so it's their real purchase — not demo data.
 */

export type OrderStatus = 'pending' | 'shipped' | 'delivered' | 'rejected';

export type PlacedOrderItem = {
  pid: string;
  title: string;
  tone: number;
  qty: number;
  size: string;
  price: number;
};

export type PlacedOrder = {
  /** Display id, e.g. `#AGL-1234567`. */
  id: string;
  orderNumber: string;
  /** ISO timestamp of when the order was placed. */
  placedAt: string;
  boutique: string;
  boutiqueId: string;
  status: OrderStatus;
  total: number;
  items: PlacedOrderItem[];
};

const KEY = 'agx-orders';

/** Timeline stage (index into demo `TRACK_STAGES`) each status maps to. */
export const STATUS_STAGE: Record<OrderStatus, number> = {
  pending: 1,
  shipped: 3,
  delivered: 5,
  rejected: 1,
};

export function readOrders(): PlacedOrder[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PlacedOrder[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Prepend newly-placed orders (newest first) and persist. Returns the full list. */
export function addOrders(orders: PlacedOrder[]): PlacedOrder[] {
  const next = [...orders, ...readOrders()];
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — the returned list still covers this session */
  }
  return next;
}

export function findOrder(id: string | undefined): PlacedOrder | undefined {
  if (!id) return undefined;
  return readOrders().find((o) => o.id === id || o.orderNumber === id);
}

/** Shape of an order row returned by /api/guest-sync (DB-backed, by phone). */
export type DbOrder = {
  order_number: string;
  total: number | string;
  status: OrderStatus;
  created_at: string;
  boutique_id: string;
  boutique: { name: string; tone: number } | null;
  items: { product_id: string | null; title: string; price: number | string; qty: number; size: string | null }[];
};

/** Map a server order (looked up by phone) onto the local PlacedOrder shape. */
export function fromDbOrder(o: DbOrder): PlacedOrder {
  const tone = o.boutique?.tone ?? 0;
  return {
    id: '#' + o.order_number,
    orderNumber: o.order_number,
    placedAt: o.created_at,
    boutique: o.boutique?.name ?? 'Boutique',
    boutiqueId: o.boutique_id,
    status: o.status,
    total: Number(o.total),
    items: (o.items ?? []).map((it) => ({
      pid: it.product_id ?? '',
      title: it.title,
      tone,
      qty: it.qty,
      size: it.size ?? '',
      price: Number(it.price),
    })),
  };
}

/** A signed-in buyer's order as read back via RLS (see data/orders.ts). */
export type BuyerDbOrder = {
  order_number: string;
  boutique_id: string;
  status: OrderStatus;
  total: number;
  created_at: string;
  boutique: { name: string; tone: number } | null;
  items: { title: string; price: number; qty: number; size: string | null }[];
};

/** Map a signed-in buyer's DB order onto the local PlacedOrder shape. */
export function fromBuyerOrder(o: BuyerDbOrder): PlacedOrder {
  const tone = o.boutique?.tone ?? 0;
  return {
    id: '#' + o.order_number,
    orderNumber: o.order_number,
    placedAt: o.created_at,
    boutique: o.boutique?.name ?? 'Boutique',
    boutiqueId: o.boutique_id,
    status: o.status,
    total: Number(o.total),
    items: (o.items ?? []).map((it) => ({ pid: '', title: it.title, tone, qty: it.qty, size: it.size ?? '', price: Number(it.price) })),
  };
}

/**
 * Merge server orders (source of truth) with any locally-stored ones, de-duped
 * by order number, newest first, and persist. Server rows win on conflict since
 * they carry the up-to-date status. Returns the merged list.
 */
export function mergeServerOrders(serverOrders: PlacedOrder[]): PlacedOrder[] {
  const byNumber = new Map<string, PlacedOrder>();
  for (const o of readOrders()) byNumber.set(o.orderNumber, o);
  for (const o of serverOrders) byNumber.set(o.orderNumber, o);
  const merged = [...byNumber.values()].sort(
    (a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime(),
  );
  try {
    localStorage.setItem(KEY, JSON.stringify(merged));
  } catch {
    /* storage unavailable — the returned list still covers this session */
  }
  return merged;
}

/** "19 Jul 2026" for order cards. */
export function formatOrderDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
