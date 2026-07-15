import { useAsync } from '@/hooks/useAsync';
import { fetchPayments } from '@/data/admin';
import { statusStyle } from '@/lib/tokens';

export function Payments() {
  const { data: payments } = useAsync(fetchPayments, []);

  return (
    <div className="overflow-hidden rounded-[18px] bg-white shadow-soft">
      <div className="grid grid-cols-[1.3fr_2fr_1fr_1fr_1fr] bg-rose-chipAlt px-5 py-3.5 text-xs font-extrabold text-rose-muted">
        <span>TXN</span>
        <span>BOUTIQUE</span>
        <span>AMOUNT</span>
        <span>COMMISSION</span>
        <span>STATUS</span>
      </div>
      {(payments ?? []).map((p) => {
        const st = statusStyle(p.status);
        return (
          <div key={p.txn} className="grid grid-cols-[1.3fr_2fr_1fr_1fr_1fr] items-center border-t border-rose-borderSoft px-5 py-3.5">
            <span className="text-[12.5px] font-bold text-rose-muted">{p.txn}</span>
            <span className="text-[13.5px] font-bold">{p.name}</span>
            <span className="text-[13px] font-bold">{p.amount}</span>
            <span className="text-[13px] font-bold text-gold">{p.commission}</span>
            <span>
              <span className="rounded-lg px-2.5 py-1 text-[11px] font-extrabold" style={{ background: st.bg, color: st.fg }}>
                {p.status}
              </span>
            </span>
          </div>
        );
      })}
      {payments?.length === 0 && <div className="px-5 py-8 text-center text-sm text-rose-muted">No transactions yet.</div>}
    </div>
  );
}
