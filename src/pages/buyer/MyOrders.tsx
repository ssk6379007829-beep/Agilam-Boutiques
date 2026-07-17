import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { ImageSlot } from '@/components/ui/ImageSlot';
import { BUYER_ORDERS, TONES, TRACK_STAGES, fmt } from '@/data/demo';

export function MyOrders() {
  const navigate = useNavigate();

  return (
    <div style={css('min-height:100%;background:#FBF6F2;padding-bottom:20px;')}>
      <div style={css('max-width:820px;margin:0 auto;')}>
        <div style={css('padding:4px 0 6px;')}>
          <div className="agx-eyebrow" style={css('font-size:10.5px;color:#B02454;')}>Purchases</div>
          <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(28px,3vw,40px);line-height:1.05;margin-top:4px;")}>My orders</div>
        </div>

        <div style={css('display:flex;flex-direction:column;gap:14px;margin-top:14px;')}>
          {BUYER_ORDERS.map((o) => {
            const delivered = o.stage === 5;
            return (
              <div
                key={o.id}
                onClick={() => navigate(`/buyer/orders/${encodeURIComponent(o.id)}/track`)}
                className="agx-lift"
                style={css('cursor:pointer;background:#fff;border:1px solid #F2E4EA;border-radius:20px;padding:15px;box-shadow:0 16px 36px -30px rgba(107,20,54,.55);')}
              >
                <div style={css('display:flex;align-items:center;justify-content:space-between;gap:10px;')}>
                  <span style={css("font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:600;color:#8A7078;")}>{o.id}</span>
                  <span style={css(`font-size:11px;font-weight:800;padding:5px 11px;border-radius:999px;background:${delivered ? '#E5F3EC' : '#FCE0EC'};color:${delivered ? '#2FA36B' : '#B02454'};`)}>
                    {TRACK_STAGES[o.stage].label}
                  </span>
                </div>
                <div style={css('display:flex;gap:14px;margin-top:12px;')}>
                  <div style={css(`position:relative;width:72px;height:90px;flex:none;border-radius:13px;overflow:hidden;background:${TONES[o.tone]};`)}>
                    <ImageSlot placeholder={o.title} style={css('position:absolute;inset:0;')} />
                  </div>
                  <div style={css('flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;')}>
                    <div style={css('font-weight:800;font-size:15px;line-height:1.2;')}>{o.title}</div>
                    <div style={css('color:#8A7078;font-size:12.5px;margin-top:3px;')}>{o.boutique} · Qty {o.qty} · Size {o.size}</div>
                    <div style={css('display:flex;align-items:center;justify-content:space-between;margin-top:9px;')}>
                      <span style={css("font-family:'Playfair Display',serif;font-weight:700;color:#B02454;font-size:18px;")}>{fmt(o.amount)}</span>
                      <span style={css('display:flex;align-items:center;gap:5px;font-size:12px;font-weight:700;color:#5C4650;')}>
                        <span style={css("font-family:'Material Symbols Outlined';font-size:16px;color:#D6336C;")}>pin_drop</span>{o.eta}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
