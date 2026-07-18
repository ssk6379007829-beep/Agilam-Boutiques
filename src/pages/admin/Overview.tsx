import { css } from '@/lib/css';
import { TONES } from '@/data/demo';
import { fmtInr } from '@/lib/tokens';
import { useAsync } from '@/hooks/useAsync';
import { fetchOverviewMetrics, fetchGmvBars } from '@/data/admin';
import { fetchApprovedBoutiques } from '@/data/boutiques';

const compactInr = (n: number) =>
  n >= 100000 ? '₹' + (n / 100000).toFixed(1) + 'L' : n >= 1000 ? '₹' + (n / 1000).toFixed(1) + 'k' : fmtInr(n);

export function Overview() {
  const { data: metrics } = useAsync(() => fetchOverviewMetrics(), []);
  const { data: bars } = useAsync(() => fetchGmvBars(), []);
  const { data: boutiqueRows } = useAsync(() => fetchApprovedBoutiques(), []);

  const GMV_BARS = bars ?? new Array(12).fill('6%');
  const BOUTIQUES = (boutiqueRows ?? []).slice(0, 5);
  const METRICS = [
    { label: 'Gross merchandise value', value: compactInr(metrics?.gmv ?? 0), icon: 'payments', tint: '#FCE0EC', ic: '#D6336C', delta: 'GMV', deltaColor: '#8A7078' },
    { label: 'Active boutiques', value: String(metrics?.activeBoutiques ?? 0), icon: 'storefront', tint: '#E6F0FA', ic: '#3A6EA5', delta: 'Live', deltaColor: '#8A7078' },
    { label: 'Orders this month', value: String(metrics?.ordersThisMonth ?? 0), icon: 'receipt_long', tint: '#F3EAF5', ic: '#9B7FC7', delta: 'MTD', deltaColor: '#8A7078' },
    { label: 'Platform revenue', value: compactInr(metrics?.platformRevenue ?? 0), icon: 'account_balance', tint: '#FBF0DA', ic: '#C99A3F', delta: '8% comm.', deltaColor: '#8A7078' },
  ];

  return (
    <div>
      <div style={css('display:grid;grid-template-columns:repeat(4,1fr);gap:16px;')}>
        {METRICS.map((m) => (
          <div key={m.label} style={css('background:#fff;border-radius:18px;padding:18px;box-shadow:0 12px 30px -24px rgba(107,20,54,.6);')}>
            <div style={css('display:flex;align-items:center;justify-content:space-between;')}>
              <div style={css(`width:38px;height:38px;border-radius:12px;background:${m.tint};display:flex;align-items:center;justify-content:center;`)}>
                <span style={css(`font-family:'Material Symbols Outlined';color:${m.ic};font-size:21px;`)}>{m.icon}</span>
              </div>
              <span style={css(`font-size:12px;font-weight:800;color:${m.deltaColor};`)}>{m.delta}</span>
            </div>
            <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:32px;line-height:1;margin-top:14px;")}>{m.value}</div>
            <div style={css('color:#8A7078;font-size:13px;font-weight:600;margin-top:3px;')}>{m.label}</div>
          </div>
        ))}
      </div>

      <div style={css('display:grid;grid-template-columns:1.6fr 1fr;gap:16px;margin-top:16px;')}>
        <div style={css('background:#fff;border-radius:18px;padding:20px;box-shadow:0 12px 30px -24px rgba(107,20,54,.6);')}>
          <div style={css('display:flex;align-items:center;justify-content:space-between;')}>
            <div style={css('font-weight:800;font-size:15px;')}>Gross merchandise value</div>
            <div style={css('font-size:12px;color:#8A7078;font-weight:700;')}>Last 12 weeks</div>
          </div>
          <div style={css('display:flex;align-items:flex-end;gap:9px;height:200px;margin-top:20px;')}>
            {GMV_BARS.map((b, i) => (
              <div key={i} style={css('flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:100%;')}>
                <div style={css(`width:100%;border-radius:6px 6px 3px 3px;background:linear-gradient(180deg,#E7719F,#D6336C);height:${b};`)} />
              </div>
            ))}
          </div>
        </div>

        <div style={css('background:#fff;border-radius:18px;padding:20px;box-shadow:0 12px 30px -24px rgba(107,20,54,.6);')}>
          <div style={css('font-weight:800;font-size:15px;')}>Top boutiques</div>
          <div style={css('display:flex;flex-direction:column;gap:12px;margin-top:16px;')}>
            {BOUTIQUES.map((b) => (
              <div key={b.id} style={css('display:flex;align-items:center;gap:11px;')}>
                <div style={css(`width:38px;height:38px;border-radius:11px;background:${TONES[b.tone]};display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-weight:700;color:rgba(42,26,32,.5);`)}>{b.name[0]}</div>
                <div style={css('flex:1;')}>
                  <div style={css('font-weight:700;font-size:13px;')}>{b.name}</div>
                  <div style={css('font-size:11.5px;color:#8A7078;')}>{b.city}</div>
                </div>
                <div style={css('font-weight:700;font-size:12.5px;color:#B02454;')}>⭐ {b.rating}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
