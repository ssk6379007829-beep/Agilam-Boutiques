import { useNavigate } from 'react-router-dom';
import { useMyBoutique } from '@/hooks/useMyBoutique';
import { useAsync } from '@/hooks/useAsync';
import { fetchCustomersForBoutique } from '@/data/orders';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Avatar } from '@/components/ui/Avatar';
import { fmtInr, toneHex } from '@/lib/tokens';

export function Customers() {
  const navigate = useNavigate();
  const { boutique } = useMyBoutique();
  const { data: customers } = useAsync(() => (boutique ? fetchCustomersForBoutique(boutique.id) : Promise.resolve([])), [boutique?.id]);

  return (
    <div className="min-h-full bg-rose-card pb-5">
      <ScreenHeader title="Customers" onBack={() => navigate('/seller/profile')} />
      <div className="flex flex-col gap-2.5 px-5">
        {(customers ?? []).map((c) => (
          <div key={c.buyer_id} className="flex items-center gap-2.5 rounded-2xl bg-white p-3 shadow-card">
            <Avatar name={c.name} size={48} radius={14} tone={toneHex(c.tone)} fontSize={20} />
            <div className="flex-1">
              <div className="text-sm font-extrabold">{c.name}</div>
              <div className="text-xs text-rose-muted">
                {c.city} · {c.orders} orders
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-extrabold text-rose-primaryDark">{fmtInr(c.spent)}</div>
              <div className="text-[11px] text-rose-mutedSoft">lifetime</div>
            </div>
          </div>
        ))}
        {customers?.length === 0 && <div className="pt-8 text-center text-sm text-rose-muted">No customers yet.</div>}
      </div>
    </div>
  );
}
