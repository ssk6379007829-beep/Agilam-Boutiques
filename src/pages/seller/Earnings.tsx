import { useNavigate } from 'react-router-dom';
import { useMyBoutique } from '@/hooks/useMyBoutique';
import { useAsync } from '@/hooks/useAsync';
import { fetchOrdersForBoutique } from '@/data/orders';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Icon } from '@/components/ui/Icon';
import { fmtInr } from '@/lib/tokens';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function Earnings() {
  const navigate = useNavigate();
  const { boutique } = useMyBoutique();
  const { data: orders } = useAsync(() => (boutique ? fetchOrdersForBoutique(boutique.id) : Promise.resolve([])), [boutique?.id]);

  const rows = orders ?? [];
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonth = rows.filter((o) => new Date(o.created_at) >= monthStart);
  const totalRevenue = thisMonth.reduce((s, o) => s + Number(o.total), 0);
  const ordersPaid = rows.filter((o) => o.status === 'shipped' || o.status === 'delivered').length;
  const pendingPayout = rows.filter((o) => o.status === 'pending').reduce((s, o) => s + Number(o.total), 0);

  const dayTotals = new Array(7).fill(0);
  rows.forEach((o) => {
    const d = new Date(o.created_at);
    const daysAgo = Math.floor((now.getTime() - d.getTime()) / (24 * 3600 * 1000));
    if (daysAgo >= 0 && daysAgo < 7) dayTotals[6 - daysAgo] += Number(o.total);
  });
  const max = Math.max(...dayTotals, 1);

  return (
    <div className="min-h-full bg-rose-card pb-5">
      <ScreenHeader title="Earnings" onBack={() => navigate('/seller/profile')} />
      <div
        className="mx-5 rounded-[20px] p-5 text-white shadow-[0_18px_40px_-22px_rgba(176,36,84,.9)]"
        style={{ background: 'linear-gradient(150deg,#D6336C,#B02454)' }}
      >
        <div className="text-[13px] opacity-85">Total revenue · This month</div>
        <div className="mt-1 font-serif text-[42px] font-bold leading-none">{fmtInr(totalRevenue)}</div>
        <div className="mt-2 flex items-center gap-1.5 text-[13px]">
          <Icon name="trending_up" className="text-[17px]" />
          Live totals from your orders
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 px-5 pt-4">
        <div className="rounded-2xl bg-white p-3.5 shadow-soft">
          <div className="text-xs font-bold text-rose-muted">Orders paid</div>
          <div className="font-serif text-[26px] font-bold">{ordersPaid}</div>
        </div>
        <div className="rounded-2xl bg-white p-3.5 shadow-soft">
          <div className="text-xs font-bold text-rose-muted">Pending payout</div>
          <div className="font-serif text-[26px] font-bold text-gold">{fmtInr(pendingPayout)}</div>
        </div>
      </div>
      <div className="px-5 pb-3 pt-5 font-serif text-xl font-bold">Weekly revenue</div>
      <div className="mx-5 flex h-[150px] items-end gap-2.5 rounded-[18px] bg-white p-4 shadow-soft">
        {dayTotals.map((v, i) => (
          <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <div
              className="w-full rounded-t-[7px] rounded-b-[3px]"
              style={{ background: 'linear-gradient(180deg,#E7719F,#D6336C)', height: `${Math.max(6, (v / max) * 100)}%` }}
            />
            <span className="text-[10.5px] font-bold text-rose-mutedSoft">{DAY_LABELS[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
