import { useAsync } from '@/hooks/useAsync';
import { fetchAllSubscriptionsAdmin } from '@/data/subscriptions';
import { statusStyle } from '@/lib/tokens';

export function Subscriptions() {
  const { data: subs } = useAsync(fetchAllSubscriptionsAdmin, []);

  const active = (subs ?? []).filter((s) => s.status === 'active');
  const recurring = active.reduce((sum, s) => sum + Number(s.price), 0);
  const featuredCount = (subs ?? []).filter((s) => s.plan === 'featured').length;

  return (
    <div>
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-[18px] bg-white p-5 shadow-soft">
          <div className="text-[13px] font-bold text-rose-muted">Active subscriptions</div>
          <div className="font-serif text-[34px] font-bold">{active.length}</div>
          <div className="text-xs font-bold text-good">₹{recurring.toLocaleString('en-IN')} / mo recurring</div>
        </div>
        <div className="rounded-[18px] bg-white p-5 shadow-soft">
          <div className="text-[13px] font-bold text-rose-muted">Commission rate</div>
          <div className="font-serif text-[34px] font-bold">8%</div>
          <div className="text-xs font-bold text-rose-muted">per completed order</div>
        </div>
        <div className="rounded-[18px] p-5 text-white shadow-[0_16px_36px_-26px_rgba(158,117,36,.9)]" style={{ background: 'linear-gradient(150deg,#C99A3F,#9E7524)' }}>
          <div className="text-[13px] font-bold opacity-90">Featured upgrades</div>
          <div className="font-serif text-[34px] font-bold">{featuredCount}</div>
          <div className="text-xs font-bold opacity-90">₹799 / mo each</div>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-[18px] bg-white shadow-soft">
        <div className="grid grid-cols-[2fr_1.2fr_1fr_1fr] bg-rose-chipAlt px-5 py-3.5 text-xs font-extrabold text-rose-muted">
          <span>BOUTIQUE</span>
          <span>PLAN</span>
          <span>RENEWAL</span>
          <span>STATUS</span>
        </div>
        {(subs ?? []).map((s) => {
          const st = statusStyle(s.status.charAt(0).toUpperCase() + s.status.slice(1));
          return (
            <div key={s.id} className="grid grid-cols-[2fr_1.2fr_1fr_1fr] items-center border-t border-rose-borderSoft px-5 py-3.5">
              <span className="text-[13.5px] font-bold">{s.boutique?.name}</span>
              <span className="text-[13px] capitalize text-rose-label">{s.plan}</span>
              <span className="text-[13px] text-rose-label">{s.renewal_date ? new Date(s.renewal_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}</span>
              <span>
                <span className="rounded-lg px-2.5 py-1 text-[11px] font-extrabold capitalize" style={{ background: st.bg, color: st.fg }}>
                  {s.status}
                </span>
              </span>
            </div>
          );
        })}
        {subs?.length === 0 && <div className="px-5 py-8 text-center text-sm text-rose-muted">No subscriptions yet.</div>}
      </div>
    </div>
  );
}
