import { useAsync } from '@/hooks/useAsync';
import { fetchOverviewMetrics, fetchGmvBars } from '@/data/admin';
import { fetchApprovedBoutiques } from '@/data/boutiques';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { fmtInr, toneHex } from '@/lib/tokens';

export function Overview() {
  const { data: metrics } = useAsync(fetchOverviewMetrics, []);
  const { data: gmvBars } = useAsync(fetchGmvBars, []);
  const { data: boutiques } = useAsync(fetchApprovedBoutiques, []);

  const cards = [
    { label: 'Gross merchandise value', value: metrics ? fmtInr(metrics.gmv) : '—', icon: 'payments', tint: '#FCE0EC', ic: '#D6336C' },
    { label: 'Active boutiques', value: String(metrics?.activeBoutiques ?? '—'), icon: 'storefront', tint: '#E6F0FA', ic: '#3A6EA5' },
    { label: 'Orders this month', value: String(metrics?.ordersThisMonth ?? '—'), icon: 'receipt_long', tint: '#F3EAF5', ic: '#9B7FC7' },
    { label: 'Platform revenue', value: metrics ? fmtInr(metrics.platformRevenue) : '—', icon: 'account_balance', tint: '#FBF0DA', ic: '#C99A3F' },
  ];

  return (
    <div>
      <div className="grid grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-[18px] bg-white p-4.5 shadow-soft">
            <div className="flex items-center justify-between">
              <div className="flex h-[38px] w-[38px] items-center justify-center rounded-xl" style={{ background: c.tint }}>
                <Icon name={c.icon} className="text-[21px]" style={{ color: c.ic }} />
              </div>
              <span className="text-xs font-extrabold text-good">+</span>
            </div>
            <div className="mt-3.5 font-serif text-[32px] font-bold leading-none">{c.value}</div>
            <div className="mt-1 text-[13px] font-semibold text-rose-muted">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-[1.6fr_1fr] gap-4">
        <div className="rounded-[18px] bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <div className="text-[15px] font-extrabold">Gross merchandise value</div>
            <div className="text-xs font-bold text-rose-muted">Last 12 weeks</div>
          </div>
          <div className="mt-5 flex h-[200px] items-end gap-2.5">
            {(gmvBars ?? new Array(12).fill('10%')).map((h, i) => (
              <div key={i} className="flex h-full flex-1 flex-col justify-end">
                <div className="w-full rounded-t-md rounded-b-[3px]" style={{ background: 'linear-gradient(180deg,#E7719F,#D6336C)', height: h }} />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[18px] bg-white p-5 shadow-soft">
          <div className="text-[15px] font-extrabold">Top boutiques</div>
          <div className="mt-4 flex flex-col gap-3">
            {(boutiques ?? []).slice(0, 5).map((b) => (
              <div key={b.id} className="flex items-center gap-2.5">
                <Avatar name={b.name} size={38} radius={11} tone={toneHex(b.tone)} fontSize={16} />
                <div className="flex-1">
                  <div className="text-[13px] font-bold">{b.name}</div>
                  <div className="text-[11.5px] text-rose-muted">{b.city}</div>
                </div>
                <div className="text-[12.5px] font-bold text-rose-primaryDark">⭐ {b.rating}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
