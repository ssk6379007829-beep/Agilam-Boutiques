import { css } from '@/lib/css';
import { useShop } from '@/state/ShopContext';
import { useAsync } from '@/hooks/useAsync';
import { fetchAds, createAd } from '@/data/ads';

const STATUS_STYLE: Record<string, { label: string; bg: string; fg: string }> = {
  live: { label: 'Live', bg: '#E5F3EC', fg: '#218456' },
  paused: { label: 'Paused', bg: '#F1E4EB', fg: '#8A7078' },
  draft: { label: 'Draft', bg: '#FBF0DA', fg: '#B8860B' },
};
const compact = (n: number) => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n));

export function Ads() {
  const { showToast } = useShop();
  const { data: rows, loading, reload } = useAsync(() => fetchAds(), []);
  const ADS = rows ?? [];

  const newCampaign = async () => {
    try {
      await createAd('New Campaign', 'Home · unassigned');
      showToast('Draft campaign created');
      reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not create campaign');
    }
  };

  return (
    <div>
      <div style={css('display:flex;justify-content:flex-end;margin-bottom:14px;')}>
        <button onClick={newCampaign} style={css('background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;border:none;border-radius:12px;padding:11px 18px;font-weight:800;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:6px;')}>
          <span style={css("font-family:'Material Symbols Outlined';font-size:18px;")}>add</span>New campaign
        </button>
      </div>

      {!loading && ADS.length === 0 && (
        <div style={css('color:#8A7078;font-size:13.5px;')}>No campaigns yet.</div>
      )}
      <div style={css('display:grid;grid-template-columns:repeat(2,1fr);gap:16px;')}>
        {ADS.map((ad) => {
          const st = STATUS_STYLE[ad.status] ?? STATUS_STYLE.draft;
          return (
          <div key={ad.id} style={css('background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 12px 30px -24px rgba(107,20,54,.6);display:flex;')}>
            <div style={css('width:120px;flex:none;background:linear-gradient(150deg,#D6336C,#B02454);position:relative;')}>
              <div style={css('position:absolute;inset:0;background:repeating-linear-gradient(115deg,rgba(255,255,255,.1) 0 2px,transparent 2px 20px);')} />
            </div>
            <div style={css('flex:1;padding:16px;')}>
              <div style={css('display:flex;justify-content:space-between;align-items:center;')}>
                <span style={css('font-weight:800;font-size:14px;')}>{ad.title}</span>
                <span style={css(`font-size:11px;font-weight:800;padding:3px 9px;border-radius:8px;background:${st.bg};color:${st.fg};`)}>{st.label}</span>
              </div>
              <div style={css('font-size:12.5px;color:#8A7078;margin-top:4px;')}>{ad.placement}</div>
              <div style={css('display:flex;gap:20px;margin-top:12px;')}>
                <div>
                  <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:22px;line-height:1;")}>{compact(ad.impressions)}</div>
                  <div style={css('font-size:11px;color:#B79AA6;')}>impressions</div>
                </div>
                <div>
                  <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:22px;line-height:1;")}>{compact(ad.clicks)}</div>
                  <div style={css('font-size:11px;color:#B79AA6;')}>clicks</div>
                </div>
              </div>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
