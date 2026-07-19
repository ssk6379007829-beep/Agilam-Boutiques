import { useState } from 'react';
import { css } from '@/lib/css';
import { useShop } from '@/state/ShopContext';
import { useAsync } from '@/hooks/useAsync';
import { fetchPayments } from '@/data/admin';
import { updateOrderStatus } from '@/data/orders';
import type { OrderStatus } from '@/types/database';

const GRID = 'display:grid;grid-template-columns:1.2fr 1.7fr 1fr 1fr .9fr 1.1fr;';
const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  Settled: { bg: '#E5F3EC', fg: '#218456' },
  Pending: { bg: '#FBF0DA', fg: '#B8860B' },
};
const ORDER_STATUSES: OrderStatus[] = ['pending', 'shipped', 'delivered', 'rejected'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function Payments() {
  const { showToast } = useShop();
  const { data: rows, loading, reload } = useAsync(() => fetchPayments(), []);
  const PAYMENTS = rows ?? [];
  const [savingId, setSavingId] = useState<string | null>(null);

  const changeStatus = async (id: string, status: OrderStatus) => {
    setSavingId(id);
    try {
      await updateOrderStatus(id, status);
      showToast(`Order marked ${cap(status)}`);
      reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not update order');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div style={css('background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 12px 30px -24px rgba(107,20,54,.6);')}>
      <div style={css(`${GRID}padding:14px 20px;background:#F7EAF0;font-size:12px;font-weight:800;color:#8A7078;`)}>
        <span>TXN</span><span>BOUTIQUE</span><span>AMOUNT</span><span>COMMISSION</span><span>SETTLEMENT</span><span style={css('text-align:right;')}>ORDER STATUS</span>
      </div>
      {loading && <div style={css('padding:20px;color:#8A7078;font-size:13.5px;')}>Loading transactions…</div>}
      {!loading && PAYMENTS.length === 0 && (
        <div style={css('padding:20px;color:#8A7078;font-size:13.5px;')}>No transactions yet.</div>
      )}
      {PAYMENTS.map((p) => {
        const s = STATUS_STYLE[p.status] ?? STATUS_STYLE.Pending;
        return (
          <div key={p.id} style={css(`${GRID}padding:14px 20px;align-items:center;border-top:1px solid #F5E4EC;`)}>
            <span style={css('font-size:12.5px;font-weight:700;color:#8A7078;')}>{p.txn}</span>
            <span style={css('font-size:13.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;')}>{p.name}</span>
            <span style={css('font-size:13px;font-weight:700;')}>{p.amount}</span>
            <span style={css('font-size:13px;color:#C99A3F;font-weight:700;')}>{p.commission}</span>
            <span><span style={css(`font-size:11px;font-weight:800;padding:4px 10px;border-radius:8px;background:${s.bg};color:${s.fg};`)}>{p.status}</span></span>
            <div style={css('display:flex;justify-content:flex-end;')}>
              <select
                value={p.orderStatus}
                disabled={savingId === p.id}
                onChange={(e) => changeStatus(p.id, e.target.value as OrderStatus)}
                style={css('height:34px;border:1.5px solid #F0D8E2;border-radius:10px;background:#FBF6F2;font-size:12.5px;font-weight:700;color:#6B5560;padding:0 8px;cursor:pointer;font-family:inherit;')}
              >
                {ORDER_STATUSES.map((st) => (
                  <option key={st} value={st}>{cap(st)}</option>
                ))}
              </select>
            </div>
          </div>
        );
      })}
    </div>
  );
}
