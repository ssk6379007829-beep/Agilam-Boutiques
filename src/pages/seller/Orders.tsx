import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMyBoutique } from '@/hooks/useMyBoutique';
import { useAsync } from '@/hooks/useAsync';
import { fetchOrdersForBoutique } from '@/data/orders';
import { fmtInr, statusStyle, toneHex } from '@/lib/tokens';

const TABS = ['All', 'Pending', 'Shipped', 'Delivered'];

export function Orders() {
  const navigate = useNavigate();
  const { boutique } = useMyBoutique();
  const { data: orders } = useAsync(() => (boutique ? fetchOrdersForBoutique(boutique.id) : Promise.resolve([])), [boutique?.id]);
  const [tab, setTab] = useState('All');

  const filtered = (orders ?? []).filter((o) => tab === 'All' || o.status === tab.toLowerCase());

  return (
    <div className="min-h-full bg-rose-card pb-5">
      <div className="px-5 pb-2 pt-1.5 font-serif text-[26px] font-bold">Orders</div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-2.5 pt-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-none rounded-full px-3.5 py-1.5 text-[12.5px] font-bold"
            style={{ background: tab === t ? '#B02454' : '#fff', color: tab === t ? '#fff' : '#6B5560' }}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2.5 px-5">
        {filtered.map((o) => {
          const st = statusStyle(o.status.charAt(0).toUpperCase() + o.status.slice(1));
          return (
            <div key={o.id} onClick={() => navigate(`/seller/orders/${o.id}`)} className="cursor-pointer rounded-2xl bg-white p-3.5 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-extrabold text-rose-muted">{o.order_number}</span>
                <span className="rounded-lg px-2.5 py-0.5 text-[10.5px] font-extrabold" style={{ background: st.bg, color: st.fg }}>
                  {o.status}
                </span>
              </div>
              <div className="mt-2.5 flex items-center gap-2.5">
                <div className="h-11 w-11 flex-none rounded-xl" style={{ background: toneHex(o.boutique?.tone ?? 0) }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-bold">{o.items?.[0]?.title ?? 'Order'}</div>
                  <div className="text-xs text-rose-muted">
                    {o.buyer?.full_name} · Qty {o.items?.reduce((s, it) => s + it.qty, 0) ?? 1}
                  </div>
                </div>
                <div className="text-[15px] font-extrabold text-rose-primaryDark">{fmtInr(o.total)}</div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="pt-8 text-center text-sm text-rose-muted">No orders in this tab.</div>}
      </div>
    </div>
  );
}
