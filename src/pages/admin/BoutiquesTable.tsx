import { useAsync } from '@/hooks/useAsync';
import { fetchAllBoutiquesAdmin } from '@/data/boutiques';
import { Avatar } from '@/components/ui/Avatar';
import { toneHex } from '@/lib/tokens';

export function BoutiquesTable() {
  const { data: boutiques } = useAsync(fetchAllBoutiquesAdmin, []);

  return (
    <div className="overflow-hidden rounded-[18px] bg-white shadow-soft">
      <div className="grid grid-cols-[2fr_1.2fr_1fr_1fr_1fr] bg-rose-chipAlt px-5 py-3.5 text-xs font-extrabold text-rose-muted">
        <span>BOUTIQUE</span>
        <span>CITY</span>
        <span>STYLES</span>
        <span>RATING</span>
        <span>STATUS</span>
      </div>
      {(boutiques ?? []).map((b) => (
        <div key={b.id} className="grid grid-cols-[2fr_1.2fr_1fr_1fr_1fr] items-center border-t border-rose-borderSoft px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <Avatar name={b.name} size={36} radius={11} tone={toneHex(b.tone)} fontSize={15} />
            <span className="text-[13.5px] font-bold">{b.name}</span>
          </div>
          <span className="text-[13px] text-rose-label">{b.city}</span>
          <span className="text-[13px] text-rose-label">{b.reviews_count}</span>
          <span className="text-[13px] font-bold text-rose-primaryDark">⭐ {b.rating}</span>
          <span>
            <span
              className="rounded-lg px-2.5 py-1 text-[11px] font-extrabold capitalize"
              style={{
                background: b.status === 'approved' ? '#E5F3EC' : b.status === 'rejected' ? '#FBE3E3' : '#FBF0DA',
                color: b.status === 'approved' ? '#218456' : b.status === 'rejected' ? '#C0392B' : '#B8860B',
              }}
            >
              {b.status}
            </span>
          </span>
        </div>
      ))}
      {boutiques?.length === 0 && <div className="px-5 py-8 text-center text-sm text-rose-muted">No boutiques yet.</div>}
    </div>
  );
}
