import { css } from '@/lib/css';
import { TONES, fmt } from '@/data/demo';
import { useAsync } from '@/hooks/useAsync';
import { fetchCustomersAdmin } from '@/data/orders';

const GRID = 'display:grid;grid-template-columns:2fr 1.2fr 1fr 1fr;';

export function CustomersAdmin() {
  const { data: rows, loading } = useAsync(() => fetchCustomersAdmin(), []);
  const CUSTOMERS = (rows ?? []).map((c) => ({ name: c.name, city: c.city ?? '—', orders: c.orders, spent: c.spent, tone: c.tone }));

  return (
    <div style={css('background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 12px 30px -24px rgba(107,20,54,.6);')}>
      <div style={css(`${GRID}padding:14px 20px;background:#F7EAF0;font-size:12px;font-weight:800;color:#8A7078;`)}>
        <span>CUSTOMER</span><span>CITY</span><span>ORDERS</span><span>SPENT</span>
      </div>
      {!loading && CUSTOMERS.length === 0 && (
        <div style={css('padding:20px;color:#8A7078;font-size:13.5px;')}>No customers yet.</div>
      )}
      {CUSTOMERS.map((c) => (
        <div key={c.name} style={css(`${GRID}padding:14px 20px;align-items:center;border-top:1px solid #F5E4EC;`)}>
          <div style={css('display:flex;align-items:center;gap:10px;')}>
            <div style={css(`width:36px;height:36px;border-radius:11px;background:${TONES[c.tone]};display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-weight:700;color:rgba(42,26,32,.5);`)}>{c.name[0]}</div>
            <span style={css('font-weight:700;font-size:13.5px;')}>{c.name}</span>
          </div>
          <span style={css('font-size:13px;color:#6B5560;')}>{c.city}</span>
          <span style={css('font-size:13px;color:#6B5560;')}>{c.orders}</span>
          <span style={css('font-size:13px;font-weight:700;color:#B02454;')}>{fmt(c.spent)}</span>
        </div>
      ))}
    </div>
  );
}
