import { css } from '@/lib/css';
import { useShop } from '@/state/ShopContext';
import { APPROVAL_TABS } from '@/data/adminDemo';
import { APPROVALS, TONES, statusStyle } from '@/data/demo';

const GRID = 'display:grid;grid-template-columns:2fr 1.2fr 1.4fr 1fr 1.4fr;';

export function Approvals() {
  const { showToast } = useShop();

  return (
    <div>
      <div style={css('display:flex;gap:9px;margin-bottom:16px;')}>
        {APPROVAL_TABS.map((t) => (
          <div key={t.label} style={css(`padding:8px 16px;border-radius:999px;font-size:13px;font-weight:700;background:${t.bg};color:${t.fg};`)}>{t.label}</div>
        ))}
      </div>

      <div style={css('background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 12px 30px -24px rgba(107,20,54,.6);')}>
        <div style={css(`${GRID}padding:14px 20px;background:#F7EAF0;font-size:12px;font-weight:800;color:#8A7078;letter-spacing:.04em;`)}>
          <span>BOUTIQUE</span><span>CITY</span><span>OWNER</span><span>STATUS</span><span style={css('text-align:right;')}>ACTION</span>
        </div>
        {APPROVALS.map((a) => {
          const st = statusStyle(a.status);
          return (
            <div key={a.name} style={css(`${GRID}padding:14px 20px;align-items:center;border-top:1px solid #F5E4EC;`)}>
              <div style={css('display:flex;align-items:center;gap:10px;')}>
                <div style={css(`width:36px;height:36px;border-radius:11px;background:${TONES[a.tone]};display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-weight:700;color:rgba(42,26,32,.5);`)}>{a.name[0]}</div>
                <span style={css('font-weight:700;font-size:13.5px;')}>{a.name}</span>
              </div>
              <span style={css('font-size:13px;color:#6B5560;')}>{a.city}</span>
              <span style={css('font-size:13px;color:#6B5560;')}>{a.owner}</span>
              <span><span style={css(`font-size:11px;font-weight:800;padding:4px 10px;border-radius:8px;background:${st.bg};color:${st.fg};`)}>{a.status}</span></span>
              <div style={css('display:flex;gap:8px;justify-content:flex-end;')}>
                <button onClick={() => showToast(`${a.name} rejected`)} style={css('width:34px;height:34px;border-radius:10px;border:1.5px solid #E7A7B4;background:#fff;color:#D6455A;cursor:pointer;display:flex;align-items:center;justify-content:center;')}>
                  <span style={css("font-family:'Material Symbols Outlined';font-size:18px;")}>close</span>
                </button>
                <button onClick={() => showToast(`${a.name} approved`)} style={css('width:34px;height:34px;border-radius:10px;border:none;background:#218456;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;')}>
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
