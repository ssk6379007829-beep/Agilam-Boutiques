import { useAsync } from '@/hooks/useAsync';
import { fetchCustomersAdmin } from '@/data/orders';
import { Avatar } from '@/components/ui/Avatar';
import { fmtInr, toneHex } from '@/lib/tokens';

export function CustomersAdmin() {
  const { data: customers } = useAsync(fetchCustomersAdmin, []);

  return (
    <div className="overflow-hidden rounded-[18px] bg-white shadow-soft">
      <div className="grid grid-cols-[2fr_1.2fr_1fr_1fr] bg-rose-chipAlt px-5 py-3.5 text-xs font-extrabold text-rose-muted">
        <span>CUSTOMER</span>
        <span>CITY</span>
        <span>ORDERS</span>
        <span>SPENT</span>
      </div>
      {(customers ?? []).map((c) => (
        <div key={c.buyer_id} className="grid grid-cols-[2fr_1.2fr_1fr_1fr] items-center border-t border-rose-borderSoft px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <Avatar name={c.name} size={36} radius={11} tone={toneHex(c.tone)} fontSize={15} />
            <span className="text-[13.5px] font-bold">{c.name}</span>
          </div>
          <span className="text-[13px] text-rose-label">{c.city}</span>
          <span className="text-[13px] text-rose-label">{c.orders}</span>
          <span className="text-[13px] font-bold text-rose-primaryDark">{fmtInr(c.spent)}</span>
        </div>
      ))}
      {customers?.length === 0 && <div className="px-5 py-8 text-center text-sm text-rose-muted">No customers yet.</div>}
    </div>
  );
}
