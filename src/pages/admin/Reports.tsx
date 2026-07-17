import { css } from '@/lib/css';
import { CAT_STATS, CITY_BARS } from '@/data/adminDemo';

export function Reports() {
  return (
    <div style={css('display:grid;grid-template-columns:1fr 1fr;gap:16px;')}>
      <div style={css('background:#fff;border-radius:18px;padding:20px;box-shadow:0 12px 30px -24px rgba(107,20,54,.6);')}>
        <div style={css('font-weight:800;font-size:15px;')}>Orders by category</div>
        <div style={css('display:flex;flex-direction:column;gap:12px;margin-top:18px;')}>
          {CAT_STATS.map((c) => (
            <div key={c.name}>
              <div style={css('display:flex;justify-content:space-between;font-size:13px;font-weight:700;margin-bottom:5px;')}>
                <span>{c.name}</span><span style={css('color:#B02454;')}>{c.pct}%</span>
              </div>
              <div style={css('height:9px;border-radius:5px;background:#F3DFE8;overflow:hidden;')}>
                <div style={css(`height:100%;width:${c.pct}%;border-radius:5px;background:linear-gradient(90deg,#E7719F,#D6336C);`)} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={css('background:#fff;border-radius:18px;padding:20px;box-shadow:0 12px 30px -24px rgba(107,20,54,.6);')}>
        <div style={css('font-weight:800;font-size:15px;')}>Revenue by city</div>
        <div style={css('display:flex;align-items:flex-end;gap:12px;height:220px;margin-top:20px;')}>
          {CITY_BARS.map((b) => (
            <div key={b.d} style={css('flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;justify-content:flex-end;height:100%;')}>
              <div style={css(`width:100%;border-radius:7px 7px 3px 3px;background:linear-gradient(180deg,#E7719F,#B02454);height:${b.h};`)} />
              <span style={css('font-size:11px;color:#8A7078;font-weight:700;')}>{b.d}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
