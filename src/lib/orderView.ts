import type { OrderWithDetails } from '@/data/types';

/**
 * Display shape the seller/admin order screens were built against (they came
 * from the demo `SellerOrder` records). `toOrderView` maps a live
 * `OrderWithDetails` row onto it so those screens render database orders.
 */
export type OrderView = {
  id: string;       // real uuid — used for routing and fetching
  number: string;   // '#AGL-2481' for display
  customer: string;
  city: string | null;
  phone: string | null;
  item: string;     // first item title (+ "+N more")
  color: string | null;
  size: string | null;
  qty: number;
  amount: number;
  status: string;   // Capitalised, for statusStyle()
  rawStatus: OrderWithDetails['status'];
  date: string;     // '15 Jul'
  tone: number;
  items: OrderWithDetails['items'];
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

export function toOrderView(o: OrderWithDetails, i = 0): OrderView {
  const items = o.items ?? [];
  const first = items[0];
  const qty = items.reduce((s, it) => s + it.qty, 0) || 1;
  const extra = items.length > 1 ? ` +${items.length - 1} more` : '';
  return {
    id: o.id,
    number: '#' + o.order_number,
    customer: o.buyer?.full_name ?? 'Customer',
    city: o.buyer?.city ?? null,
    phone: o.buyer?.phone ?? null,
    item: (first?.title ?? 'Item') + extra,
    color: first?.color ?? null,
    size: first?.size ?? null,
    qty,
    amount: Number(o.total),
    status: cap(o.status),
    rawStatus: o.status,
    date: fmtDate(o.created_at),
    tone: (o.boutique?.tone ?? i) % 8,
    items,
  };
}
