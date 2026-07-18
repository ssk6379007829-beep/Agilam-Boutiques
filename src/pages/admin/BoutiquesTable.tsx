import { css } from '@/lib/css';
import { TONES, statusStyle } from '@/data/demo';
import { useAsync } from '@/hooks/useAsync';
import { fetchAllBoutiquesAdmin } from '@/data/boutiques';

const GRID = 'display:grid;grid-template-columns:2fr 1.2fr 1fr 1fr 1fr;';
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function BoutiquesTable() {
  const { data: rows, loading } = useAsync(() => fetchAllBoutiquesAdmin(), []);
  const boutiques = rows ?? [];

  return (
    <div style={css('background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 12px 30px -24px rgba(107,20,54,.6);')}>
      <div style={css(`${GRID}padding:14px 20px;background:#F7EAF0;font-size:12px;font-weight:800;color:#8A7078;`)}>
        <span>BOUTIQUE</span><span>CITY</span><span>RATING</span><span>REVIEWS</span><span>STATUS</span>
      </div>
      {!loading && boutiques.length === 0 && (
        <div style={css('padding:20px;color:#8A7078;font-size:13.5px;')}>No boutiques yet.</div>
      )}
      {boutiques.map((b, i) => {
        const label = b.status === 'approved' ? 'Active' : cap(b.status);
        const st = statusStyle(cap(b.status));
        return (
          <div key={b.id} style={css(`${GRID}padding:14px 20px;align-items:center;border-top:1px solid #F5E4EC;`)}>
            <div style={css('display:flex;align-items:center;gap:10px;')}>
              <div style={css(`width:36px;height:36px;border-radius:11px;background:${TONES[b.tone ?? i % TONES.length]};display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-weight:700;color:rgba(42,26,32,.5);`)}>{b.name[0]}</div>
              <span style={css('font-weight:700;font-size:13.5px;')}>{b.name}</span>
            </div>
            <span style={css('font-size:13px;color:#6B5560;')}>{b.city || '—'}</span>
            <span style={css('font-size:13px;font-weight:700;color:#B02454;')}>⭐ {b.rating}</span>
            <span style={css('font-size:13px;color:#6B5560;')}>{b.reviews_count}</span>
            <span><span style={css(`font-size:11px;font-weight:800;padding:4px 10px;border-radius:8px;background:${st.bg};color:${st.fg};`)}>{label}</span></span>
          </div>
        );
      })}
    </div>
  );
}
