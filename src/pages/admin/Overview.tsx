import { css } from '@/lib/css';
import { GMV_BARS, METRICS } from '@/data/adminDemo';
import { BOUTIQUES, TONES } from '@/data/demo';

export function Overview() {
  return (
    <div>
      <div style={css('display:grid;grid-template-columns:repeat(4,1fr);gap:16px;')}>
        {METRICS.map((m) => (
          <div key={m.label} style={css('background:#fff;border-radius:18px;padding:18px;box-shadow:0 12px 30px -24px rgba(107,20,54,.6);')}>
            <div style={css('display:flex;align-items:center;justify-content:space-between;')}>
              <div style={css(`width:38px;height:38px;border-radius:12px;background:${m.tint};display:flex;align-items:center;justify-content:center;`)}>
                <span style={css(`font-family:'Material Symbols Outlined';color:${m.ic};font-size:21px;`)}>{m.icon}</span>
              </div>
              <span style={css(`font-size:12px;font-weight:800;color:${m.deltaColor};`)}>{m.delta}</span>
            </div>
            <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:32px;line-height:1;margin-top:14px;")}>{m.value}</div>
            <div style={css('color:#8A7078;font-size:13px;font-weight:600;margin-top:3px;')}>{m.label}</div>
          </div>
        ))}
      </div>

      <div style={css('display:grid;grid-template-columns:1.6fr 1fr;gap:16px;margin-top:16px;')}>
        <div style={css('background:#fff;border-radius:18px;padding:20px;box-shadow:0 12px 30px -24px rgba(107,20,54,.6);')}>
          <div style={css('display:flex;align-items:center;justify-content:space-between;')}>
            <div style={css('font-weight:800;font-size:15px;')}>Gross merchandise value</div>
            <div style={css('font-size:12px;color:#8A7078;font-weight:700;')}>Last 12 weeks</div>
          </div>
          <div style={css('display:flex;align-items:flex-end;gap:9px;height:200px;margin-top:20px;')}>
            {GMV_BARS.map((b, i) => (
              <div key={i} style={css('flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:100%;')}>
                <div style={css(`width:100%;border-radius:6px 6px 3px 3px;background:linear-gradient(180deg,#E7719F,#D6336C);height:${b};`)} />
              </div>
            ))}
          </div>
        </div>

        <div style={css('background:#fff;border-radius:18px;padding:20px;box-shadow:0 12px 30px -24px rgba(107,20,54,.6);')}>
          <div style={css('font-weight:800;font-size:15px;')}>Top boutiques</div>
          <div style={css('display:flex;flex-direction:column;gap:12px;margin-top:16px;')}>
            {BOUTIQUES.map((b) => (
              <div key={b.id} style={css('display:flex;align-items:center;gap:11px;')}>
                <div style={css(`width:38px;height:38px;border-radius:11px;background:${TONES[b.tone]};display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-weight:700;color:rgba(42,26,32,.5);`)}>{b.name[0]}</div>
                <div style={css('flex:1;')}>
                  <div style={css('font-weight:700;font-size:13px;')}>{b.name}</div>
                  <div style={css('font-size:11.5px;color:#8A7078;')}>{b.city}</div>
                </div>
                <div style={css('font-weight:700;font-size:12.5px;color:#B02454;')}>⭐ {b.rating}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
