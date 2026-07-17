import { useState } from 'react';
import { css } from '@/lib/css';
import { useShop } from '@/state/ShopContext';
import { COUPONS, TONES, fmt } from '@/data/demo';

export function Coupons() {
  const { appliedCoupon, applyCoupon, subtotal, showToast } = useShop();
  const [code, setCode] = useState('');

  const list = COUPONS.map((c) => {
    const eligible = c.type !== 'flat' || subtotal >= c.min;
    const applied = appliedCoupon === c.code;
    return {
      ...c,
      eligible,
      applied,
      note: c.type === 'flat' && !eligible ? `Add ${fmt(c.min - subtotal)} more to use` : `Valid till ${c.expires}`,
      btnLabel: applied ? 'Applied' : 'Apply',
      btnBg: applied ? '#FCE0EC' : '#fff',
      dimOpacity: eligible ? 1 : 0.6,
    };
  });

  const applyTyped = () => {
    const match = COUPONS.find((c) => c.code === code.trim().toUpperCase());
    if (!match) return showToast('Invalid coupon code');
    if (match.type === 'flat' && subtotal < match.min) return showToast(`Add ${fmt(match.min - subtotal)} more to use`);
    applyCoupon(match.code);
  };

  return (
    <div style={css('min-height:100%;background:#FBF6F2;padding-bottom:20px;')}>
      <div style={css('max-width:720px;margin:0 auto;')}>
        <div style={css('padding:4px 0 6px;')}>
          <div className="agx-eyebrow" style={css('font-size:10.5px;color:#B02454;')}>Save more</div>
          <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(28px,3vw,40px);line-height:1.05;margin-top:4px;")}>Coupons &amp; offers</div>
        </div>

        <div style={css('display:flex;align-items:center;margin-top:14px;background:#fff;border:1.5px dashed #E7B7CB;border-radius:15px;padding:5px 5px 5px 16px;box-shadow:0 14px 32px -30px rgba(107,20,54,.5);')}>
          <span style={css("font-family:'Material Symbols Outlined';color:#B02454;")}>confirmation_number</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter coupon code"
            style={css('border:none;background:none;flex:1;margin-left:11px;font-size:14px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#241019;min-width:0;')}
          />
          <button onClick={applyTyped} style={css('height:44px;padding:0 20px;border:none;border-radius:12px;background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;font-weight:800;font-size:13.5px;cursor:pointer;')}>Apply</button>
        </div>

        <div style={css('display:flex;flex-direction:column;gap:14px;margin-top:18px;')}>
          {list.map((c) => (
            <div key={c.code} style={css(`display:flex;background:#fff;border:1px solid #F2E4EA;border-radius:20px;overflow:hidden;box-shadow:0 16px 36px -30px rgba(107,20,54,.55);opacity:${c.dimOpacity};`)}>
              <div style={css(`width:66px;flex:none;background:${TONES[c.tone]};display:flex;align-items:center;justify-content:center;`)}>
                <span style={css("font-family:'Material Symbols Outlined';font-size:30px;color:rgba(42,26,32,.55);")}>local_offer</span>
              </div>
              <div style={css('flex:1;min-width:0;padding:15px;')}>
                <div style={css('display:flex;align-items:center;gap:9px;flex-wrap:wrap;')}>
                  <span style={css("font-family:'IBM Plex Mono',monospace;font-weight:600;font-size:15px;color:#B02454;letter-spacing:.04em;")}>{c.code}</span>
                  {c.applied && <span style={css('font-size:10px;font-weight:800;color:#218456;background:#E5F3EC;border-radius:6px;padding:2px 7px;')}>APPLIED</span>}
                </div>
                <div style={css('font-weight:700;font-size:13.5px;color:#4B3840;margin-top:5px;')}>{c.desc}</div>
                <div style={css('color:#8A7078;font-size:11.5px;margin-top:4px;')}>{c.note}</div>
              </div>
              <button
                onClick={() => c.eligible && applyCoupon(c.code)}
                style={css(`align-self:center;margin-right:14px;flex:none;height:40px;padding:0 18px;border:1.5px solid #D6336C;background:${c.btnBg};color:#B02454;border-radius:12px;font-weight:800;font-size:13px;cursor:pointer;`)}
              >
                {c.btnLabel}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
