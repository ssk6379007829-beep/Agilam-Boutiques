import { useAsync } from '@/hooks/useAsync';
import { fetchCategoryStats, fetchRevenueByCity } from '@/data/admin';

export function Reports() {
  const { data: catStats } = useAsync(fetchCategoryStats, []);
  const { data: cityBars } = useAsync(fetchRevenueByCity, []);

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="rounded-[18px] bg-white p-5 shadow-soft">
        <div className="text-[15px] font-extrabold">Orders by category</div>
        <div className="mt-4.5 flex flex-col gap-3">
          {(catStats ?? []).map((c) => (
            <div key={c.name}>
              <div className="mb-1.5 flex justify-between text-[13px] font-bold">
                <span>{c.name}</span>
                <span className="text-rose-primaryDark">{c.pct}%</span>
              </div>
              <div className="h-[9px] overflow-hidden rounded-full bg-rose-borderMid">
                <div className="h-full rounded-full" style={{ width: `${c.pct}%`, background: 'linear-gradient(90deg,#E7719F,#D6336C)' }} />
              </div>
            </div>
          ))}
          {catStats?.length === 0 && <div className="text-sm text-rose-muted">No product data yet.</div>}
        </div>
      </div>
      <div className="rounded-[18px] bg-white p-5 shadow-soft">
        <div className="text-[15px] font-extrabold">Revenue by city</div>
        <div className="mt-5 flex h-[220px] items-end gap-3">
          {(cityBars ?? []).map((b) => (
            <div key={b.d} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
              <div className="w-full rounded-t-[7px] rounded-b-[3px]" style={{ background: 'linear-gradient(180deg,#E7719F,#B02454)', height: b.h }} />
              <span className="text-[11px] font-bold text-rose-muted">{b.d}</span>
            </div>
          ))}
          {cityBars?.length === 0 && <div className="text-sm text-rose-muted">No order data yet.</div>}
        </div>
      </div>
    </div>
  );
}
