import { css } from '@/lib/css';
import { BOUTIQUES, TONES } from '@/data/demo';

const GRID = 'display:grid;grid-template-columns:2fr 1.2fr 1fr 1fr 1fr;';

export function BoutiquesTable() {
  return (
    <div style={css('background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 12px 30px -24px rgba(107,20,54,.6);')}>
      <div style={css(`${GRID}padding:14px 20px;background:#F7EAF0;font-size:12px;font-weight:800;color:#8A7078;`)}>
        <span>BOUTIQUE</span><span>CITY</span><span>STYLES</span><span>RATING</span><span>STATUS</span>
      </div>
      {BOUTIQUES.map((b) => (
        <div key={b.id} style={css(`${GRID}padding:14px 20px;align-items:center;border-top:1px solid #F5E4EC;`)}>
          <div style={css('display:flex;align-items:center;gap:10px;')}>
            <div style={css(`width:36px;height:36px;border-radius:11px;background:${TONES[b.tone]};display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-weight:700;color:rgba(42,26,32,.5);`)}>{b.name[0]}</div>
            <span style={css('font-weight:700;font-size:13.5px;')}>{b.name}</span>
          </div>
          <span style={css('font-size:13px;color:#6B5560;')}>{b.city}</span>
          <span style={css('font-size:13px;color:#6B5560;')}>{b.products}</span>
          <span style={css('font-size:13px;font-weight:700;color:#B02454;')}>⭐ {b.rating}</span>
          <span><span style={css('font-size:11px;font-weight:800;padding:4px 10px;border-radius:8px;background:#E5F3EC;color:#218456;')}>Active</span></span>
        </div>
      ))}
    </div>
  );
}
