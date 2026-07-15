import { useState } from 'react';
import { useAsync } from '@/hooks/useAsync';
import { fetchAllBoutiquesAdmin, setBoutiqueStatus } from '@/data/boutiques';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { statusStyle, toneHex } from '@/lib/tokens';
import { useToast } from '@/components/ui/Toast';

const TABS = ['pending', 'approved', 'rejected'] as const;

export function Approvals() {
  const { data: boutiques, reload } = useAsync(fetchAllBoutiquesAdmin, []);
  const toast = useToast();
  const [tab, setTab] = useState<(typeof TABS)[number]>('pending');

  const counts = TABS.map((t) => (boutiques ?? []).filter((b) => b.status === t).length);
  const filtered = (boutiques ?? []).filter((b) => b.status === tab);

  async function decide(id: string, status: 'approved' | 'rejected') {
    await setBoutiqueStatus(id, status);
    toast(status === 'approved' ? 'Boutique approved' : 'Boutique rejected');
    reload();
  }

  return (
    <div>
      <div className="mb-4 flex gap-2.5">
        {TABS.map((t) => (
          <div
            key={t}
            onClick={() => setTab(t)}
            className="cursor-pointer rounded-full px-4 py-2 text-[13px] font-bold capitalize"
            style={{ background: tab === t ? '#B02454' : '#fff', color: tab === t ? '#fff' : '#6B5560' }}
          >
            {t} · {counts[TABS.indexOf(t)]}
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-[18px] bg-white shadow-soft">
        <div className="grid grid-cols-[2fr_1.2fr_1.4fr_1fr_1.4fr] bg-rose-chipAlt px-5 py-3.5 text-xs font-extrabold tracking-wide text-rose-muted">
          <span>BOUTIQUE</span>
          <span>CITY</span>
          <span>OWNER</span>
          <span>STATUS</span>
          <span className="text-right">ACTION</span>
        </div>
        {filtered.map((b) => {
          const st = statusStyle(b.status.charAt(0).toUpperCase() + b.status.slice(1));
          return (
            <div key={b.id} className="grid grid-cols-[2fr_1.2fr_1.4fr_1fr_1.4fr] items-center border-t border-rose-borderSoft px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <Avatar name={b.name} size={36} radius={11} tone={toneHex(b.tone)} fontSize={15} />
                <span className="text-[13.5px] font-bold">{b.name}</span>
              </div>
              <span className="text-[13px] text-rose-label">{b.city}</span>
              <span className="text-[13px] text-rose-label">—</span>
              <span>
                <span className="rounded-lg px-2.5 py-1 text-[11px] font-extrabold" style={{ background: st.bg, color: st.fg }}>
                  {b.status}
                </span>
              </span>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => decide(b.id, 'rejected')}
                  className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border-[1.5px] border-rose-dangerBorder bg-white text-rose-danger"
                >
                  <Icon name="close" className="text-lg" />
                </button>
                <button
                  onClick={() => decide(b.id, 'approved')}
                  className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border-none bg-[#218456] text-white"
                >
                  <Icon name="check" className="text-lg" />
                </button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="px-5 py-8 text-center text-sm text-rose-muted">Nothing here.</div>}
      </div>
    </div>
  );
}
