import { useState } from 'react';
import { css } from '@/lib/css';
import { useShop } from '@/state/ShopContext';
import { TONES, statusStyle } from '@/data/demo';
import { useAsync } from '@/hooks/useAsync';
import { fetchAllBoutiquesAdmin, setBoutiqueStatus } from '@/data/boutiques';

const GRID = 'display:grid;grid-template-columns:2fr 1.2fr 1.4fr 1fr 1.4fr;';
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function Approvals() {
  const { showToast } = useShop();
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const { data: rows, loading, reload } = useAsync(() => fetchAllBoutiquesAdmin(), []);

  const all = rows ?? [];
  const counts = {
    pending: all.filter((b) => b.status === 'pending').length,
    approved: all.filter((b) => b.status === 'approved').length,
    rejected: all.filter((b) => b.status === 'rejected').length,
  };
  const tabs: { key: 'pending' | 'approved' | 'rejected'; label: string }[] = [
    { key: 'pending', label: `Pending · ${counts.pending}` },
    { key: 'approved', label: `Approved · ${counts.approved}` },
    { key: 'rejected', label: `Rejected · ${counts.rejected}` },
  ];
  const list = all.filter((b) => b.status === tab);

  const act = async (id: string, name: string, status: 'approved' | 'rejected') => {
    try {
      await setBoutiqueStatus(id, status);
      showToast(`${name} ${status}`);
      reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Update failed');
    }
  };

  return (
    <div>
      <div style={css('display:flex;gap:9px;margin-bottom:16px;')}>
        {tabs.map((t) => {
          const on = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={css(`padding:8px 16px;border:none;border-radius:999px;font-size:13px;font-weight:700;cursor:pointer;background:${on ? '#B02454' : '#fff'};color:${on ? '#fff' : '#6B5560'};`)}>{t.label}</button>
          );
        })}
      </div>

      <div style={css('background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 12px 30px -24px rgba(107,20,54,.6);')}>
        <div style={css(`${GRID}padding:14px 20px;background:#F7EAF0;font-size:12px;font-weight:800;color:#8A7078;letter-spacing:.04em;`)}>
          <span>BOUTIQUE</span><span>CITY</span><span>OWNER</span><span>STATUS</span><span style={css('text-align:right;')}>ACTION</span>
        </div>
        {!loading && list.length === 0 && (
          <div style={css('padding:20px;color:#8A7078;font-size:13.5px;')}>No {tab} boutiques.</div>
        )}
        {list.map((a, i) => {
          const st = statusStyle(cap(a.status));
          return (
            <div key={a.id} style={css(`${GRID}padding:14px 20px;align-items:center;border-top:1px solid #F5E4EC;`)}>
              <div style={css('display:flex;align-items:center;gap:10px;')}>
                <div style={css(`width:36px;height:36px;border-radius:11px;background:${TONES[a.tone ?? i % TONES.length]};display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-weight:700;color:rgba(42,26,32,.5);`)}>{a.name[0]}</div>
                <span style={css('font-weight:700;font-size:13.5px;')}>{a.name}</span>
              </div>
              <span style={css('font-size:13px;color:#6B5560;')}>{a.city || '—'}</span>
              <span style={css('font-size:13px;color:#6B5560;')}>{a.owner?.full_name ?? '—'}</span>
              <span><span style={css(`font-size:11px;font-weight:800;padding:4px 10px;border-radius:8px;background:${st.bg};color:${st.fg};`)}>{cap(a.status)}</span></span>
              <div style={css('display:flex;gap:8px;justify-content:flex-end;')}>
                <button onClick={() => act(a.id, a.name, 'rejected')} style={css('width:34px;height:34px;border-radius:10px;border:1.5px solid #E7A7B4;background:#fff;color:#D6455A;cursor:pointer;display:flex;align-items:center;justify-content:center;')}>
                  <span style={css("font-family:'Material Symbols Outlined';font-size:18px;")}>close</span>
                </button>
                <button onClick={() => act(a.id, a.name, 'approved')} style={css('width:34px;height:34px;border-radius:10px;border:none;background:#218456;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;')}>
                  <span style={css("font-family:'Material Symbols Outlined';font-size:18px;")}>check</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
