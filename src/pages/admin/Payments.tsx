import { css } from '@/lib/css';
import { useAsync } from '@/hooks/useAsync';
import { fetchPayments } from '@/data/admin';

const GRID = 'display:grid;grid-template-columns:1.3fr 2fr 1fr 1fr 1fr;';
const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  Settled: { bg: '#E5F3EC', fg: '#218456' },
  Pending: { bg: '#FBF0DA', fg: '#B8860B' },
};

export function Payments() {
  const { data: rows, loading } = useAsync(() => fetchPayments(), []);
  const PAYMENTS = (rows ?? []).map((p) => ({ ...p, ...(STATUS_STYLE[p.status] ?? STATUS_STYLE.Pending) }));

  return (
    <div style={css('background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 12px 30px -24px rgba(107,20,54,.6);')}>
      <div style={css(`${GRID}padding:14px 20px;background:#F7EAF0;font-size:12px;font-weight:800;color:#8A7078;`)}>
        <span>TXN</span><span>BOUTIQUE</span><span>AMOUNT</span><span>COMMISSION</span><span>STATUS</span>
      </div>
      {!loading && PAYMENTS.length === 0 && (
        <div style={css('padding:20px;color:#8A7078;font-size:13.5px;')}>No transactions yet.</div>
      )}
      {PAYMENTS.map((p) => (
        <div key={p.txn} style={css(`${GRID}padding:14px 20px;align-items:center;border-top:1px solid #F5E4EC;`)}>
          <span style={css('font-size:12.5px;font-weight:700;color:#8A7078;')}>{p.txn}</span>
          <span style={css('font-size:13.5px;font-weight:700;')}>{p.name}</span>
          <span style={css('font-size:13px;font-weight:700;')}>{p.amount}</span>
          <span style={css('font-size:13px;color:#C99A3F;font-weight:700;')}>{p.commission}</span>
          <span><span style={css(`font-size:11px;font-weight:800;padding:4px 10px;border-radius:8px;background:${p.bg};color:${p.fg};`)}>{p.status}</span></span>
        </div>
      ))}
    </div>
  );
}
