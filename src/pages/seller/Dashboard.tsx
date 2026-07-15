import { useNavigate } from 'react-router-dom';
import { useMyBoutique } from '@/hooks/useMyBoutique';
import { useAsync } from '@/hooks/useAsync';
import { fetchOrdersForBoutique } from '@/data/orders';
import { fetchProductsByBoutique } from '@/data/products';
import { fetchCustomersForBoutique } from '@/data/orders';
import { Icon } from '@/components/ui/Icon';
import { fmtInr, statusStyle, toneHex } from '@/lib/tokens';

export function Dashboard() {
  const navigate = useNavigate();
  const { boutique } = useMyBoutique();
  const { data: orders } = useAsync(() => (boutique ? fetchOrdersForBoutique(boutique.id) : Promise.resolve([])), [boutique?.id]);
  const { data: products } = useAsync(() => (boutique ? fetchProductsByBoutique(boutique.id) : Promise.resolve([])), [boutique?.id]);
  const { data: customers } = useAsync(() => (boutique ? fetchCustomersForBoutique(boutique.id) : Promise.resolve([])), [boutique?.id]);

  if (!boutique) {
    return <div className="p-6 text-center text-sm text-rose-muted">Setting up your boutique…</div>;
  }

  const stats = [
    { label: 'Total Products', value: String(products?.length ?? 0), icon: 'inventory_2', tint: '#FCE0EC', ic: '#D6336C' },
    { label: 'Total Orders', value: String(orders?.length ?? 0), icon: 'receipt_long', tint: '#E6F0FA', ic: '#3A6EA5' },
    { label: 'Total Views', value: '—', icon: 'visibility', tint: '#F3EAF5', ic: '#9B7FC7' },
    { label: 'Total Customers', value: String(customers?.length ?? 0), icon: 'group', tint: '#E5F3EC', ic: '#2FA36B' },
  ];

  return (
    <div className="min-h-full bg-rose-card pb-5">
      <div className="rounded-b-[26px] px-5 pb-7 pt-3.5 text-white" style={{ background: 'linear-gradient(150deg,#D6336C,#B02454)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-[46px] w-[46px] items-center justify-center rounded-2xl bg-white/20 font-serif text-2xl font-bold">
              {boutique.name[0]}
            </div>
            <div>
              <div className="text-xs opacity-85">My Boutique</div>
              <div className="flex items-center gap-1">
                <span className="font-serif text-xl font-bold">{boutique.name}</span>
                {boutique.verified && <Icon name="verified" className="text-base" />}
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate('/seller/notifications')}
            className="relative flex h-[42px] w-[42px] items-center justify-center rounded-2xl border-none bg-white/15"
          >
            <Icon name="notifications" className="text-white" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#FFD84D]" />
          </button>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/20 bg-white/15 p-3.5">
          <div>
            <div className="text-[15px] font-extrabold">Welcome back, {boutique.name.split(' ')[0]}!</div>
            <div className="mt-0.5 text-[12.5px] opacity-85">Ready to add a new arrival?</div>
          </div>
          <button
            onClick={() => navigate('/seller/add-product')}
            className="flex items-center gap-1.5 rounded-xl border-none bg-white px-3.5 py-2.5 text-[13px] font-extrabold text-rose-primaryDark"
          >
            <Icon name="add" className="text-lg" />
            Add
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-5 pt-4.5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-[18px] bg-white p-3.5 shadow-soft">
            <div className="flex h-9 w-9 items-center justify-center rounded-[11px]" style={{ background: s.tint }}>
              <Icon name={s.icon} className="text-xl" style={{ color: s.ic }} />
            </div>
            <div className="mt-2.5 font-serif text-[30px] font-bold leading-none">{s.value}</div>
            <div className="mt-0.5 text-[12.5px] font-semibold text-rose-muted">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-5 pb-3 pt-5.5">
        <div className="font-serif text-[22px] font-bold">Recent Orders</div>
        <a onClick={() => navigate('/seller/orders')} className="cursor-pointer text-[13px] font-bold">
          View all
        </a>
      </div>
      <div className="flex flex-col gap-2.5 px-5">
        {(orders ?? []).slice(0, 4).map((o) => {
          const st = statusStyle(o.status.charAt(0).toUpperCase() + o.status.slice(1));
          return (
            <div
              key={o.id}
              onClick={() => navigate(`/seller/orders/${o.id}`)}
              className="flex cursor-pointer items-center gap-2.5 rounded-2xl bg-white p-3 shadow-card"
            >
              <div className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[13px] font-serif font-bold text-black/50" style={{ background: toneHex(o.boutique?.tone ?? 0) }}>
                {o.buyer?.full_name?.[0]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-extrabold">{o.buyer?.full_name}</div>
                <div className="truncate text-xs text-rose-muted">{o.items?.[0]?.title ?? o.order_number}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-extrabold text-rose-primaryDark">{fmtInr(o.total)}</div>
                <span className="mt-0.5 inline-block rounded-lg px-2 py-0.5 text-[10.5px] font-extrabold" style={{ background: st.bg, color: st.fg }}>
                  {o.status}
                </span>
              </div>
            </div>
          );
        })}
        {orders?.length === 0 && <div className="pt-4 text-center text-sm text-rose-muted">No orders yet.</div>}
      </div>
    </div>
  );
}
