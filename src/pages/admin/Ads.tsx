import { css } from '@/lib/css';
import { useShop } from '@/state/ShopContext';
import { ADS } from '@/data/adminDemo';

export function Ads() {
  const { showToast } = useShop();

  return (
    <div>
      <div style={css('display:flex;justify-content:flex-end;margin-bottom:14px;')}>
        <button onClick={() => showToast('New campaign')} style={css('background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;border:none;border-radius:12px;padding:11px 18px;font-weight:800;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:6px;')}>
          <span style={css("font-family:'Material Symbols Outlined';font-size:18px;")}>add</span>New campaign
        </button>
      </div>

      <div style={css('display:grid;grid-template-columns:repeat(2,1fr);gap:16px;')}>
        {ADS.map((ad) => (
          <div key={ad.title} style={css('background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 12px 30px -24px rgba(107,20,54,.6);display:flex;')}>
            <div style={css('width:120px;flex:none;background:linear-gradient(150deg,#D6336C,#B02454);position:relative;')}>
              <div style={css('position:absolute;inset:0;background:repeating-linear-gradient(115deg,rgba(255,255,255,.1) 0 2px,transparent 2px 20px);')} />
            </div>
            <div style={css('flex:1;padding:16px;')}>
              <div style={css('display:flex;justify-content:space-between;align-items:center;')}>
                <span style={css('font-weight:800;font-size:14px;')}>{ad.title}</span>
                <span style={css(`font-size:11px;font-weight:800;padding:3px 9px;border-radius:8px;background:${ad.bg};color:${ad.fg};`)}>{ad.status}</span>
              </div>
              <div style={css('font-size:12.5px;color:#8A7078;margin-top:4px;')}>{ad.placement}</div>
              <div style={css('display:flex;gap:20px;margin-top:12px;')}>
                <div>
                  <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:22px;line-height:1;")}>{ad.impressions}</div>
                  <div style={css('font-size:11px;color:#B79AA6;')}>impressions</div>
                </div>
                <div>
                  <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:22px;line-height:1;")}>{ad.clicks}</div>
                  <div style={css('font-size:11px;color:#B79AA6;')}>clicks</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
