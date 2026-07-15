import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAsync } from '@/hooks/useAsync';
import { fetchApprovedBoutiques } from '@/data/boutiques';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { toneHex } from '@/lib/tokens';
import { useToast } from '@/components/ui/Toast';

export function Boutiques() {
  const navigate = useNavigate();
  const toast = useToast();
  const { data: boutiques } = useAsync(fetchApprovedBoutiques, []);
  const [query, setQuery] = useState('');

  const filtered = (boutiques ?? []).filter(
    (b) => b.name.toLowerCase().includes(query.toLowerCase()) || b.city.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="min-h-full bg-rose-card pb-5">
      <div className="px-5 pb-3 pt-1.5">
        <div className="font-serif text-[28px] font-bold">Boutiques</div>
        <div className="mt-0.5 text-[13px] text-rose-muted">Every local boutique, one place</div>
        <div className="mt-3.5 flex h-[46px] items-center gap-2 rounded-2xl bg-white px-3 shadow-card">
          <Icon name="search" className="text-rose-mutedSoft" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search boutiques or city…"
            className="flex-1 border-none bg-transparent text-sm font-medium outline-none"
          />
        </div>
      </div>
      <div className="flex flex-col gap-3 px-5">
        {filtered.map((b) => (
          <div
            key={b.id}
            onClick={() => navigate(`/buyer/boutique/${b.id}`)}
            className="flex cursor-pointer items-center gap-3 rounded-[18px] bg-white p-3 shadow-soft"
          >
            <Avatar name={b.name} size={64} radius={16} tone={toneHex(b.tone)} fontSize={26} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[15px] font-extrabold">{b.name}</span>
                {b.verified && <Icon name="verified" className="text-base" style={{ color: '#3A8DD6' }} />}
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-[12.5px] text-rose-muted">
                <Icon name="location_on" className="text-sm" />
                {b.city}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[12.5px] font-bold">
                <Icon name="star" className="text-[15px]" style={{ color: '#E0B84B' }} />
                {b.rating} <span className="font-semibold text-rose-mutedSoft">· {b.reviews_count}</span>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toast('Following ' + b.name);
              }}
              className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-xl border-[1.5px] border-rose-border bg-white"
            >
              <Icon name="favorite_border" className="text-lg" style={{ color: '#D6336C' }} />
            </button>
          </div>
        ))}
        {filtered.length === 0 && <div className="pt-8 text-center text-sm text-rose-muted">No boutiques found.</div>}
      </div>
    </div>
  );
}
