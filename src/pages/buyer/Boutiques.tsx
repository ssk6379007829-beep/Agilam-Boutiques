import { type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { ImageSlot } from '@/components/ui/ImageSlot';
import { useShop } from '@/state/ShopContext';
import { useCatalog } from '@/state/CatalogContext';
import { TONES } from '@/data/demo';

export function Boutiques() {
  const navigate = useNavigate();
  const { showToast } = useShop();
  const { boutiques: BOUTIQUES } = useCatalog();

  return (
    <div style={css('min-height:100%;background:#FBF6F2;padding-bottom:20px;')}>
      <div style={css('display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:14px;padding:4px 0 6px;')}>
        <div>
          <div className="agx-eyebrow" style={css('font-size:10.5px;color:#B02454;')}>The directory</div>
          <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(27px,3.2vw,42px);line-height:1.1;padding-bottom:2px;margin-top:6px;letter-spacing:-.01em;")}>Boutiques</div>
          <div style={css('color:#8A7078;font-size:14px;margin-top:6px;')}>Every local boutique across Tamil Nadu, in one place.</div>
        </div>
        <div style={css('display:flex;align-items:center;gap:9px;background:#fff;border:1px solid #EFDCE4;border-radius:15px;padding:0 14px;height:48px;box-shadow:0 8px 22px -16px rgba(107,20,54,.5);min-width:min(320px,100%);')}>
          <span style={css("font-family:'Material Symbols Outlined';color:#B79AA6;")}>search</span>
          <input placeholder="Search boutiques or city…" style={css('border:none;background:none;flex:1;font-size:14px;font-weight:500;min-width:0;')} />
        </div>
      </div>

      <div className="agx-rgrid" style={css('margin-top:22px;')}>
        {BOUTIQUES.map((b) => (
          <div key={b.id} onClick={() => navigate(`/buyer/boutique/${b.id}`)} className="agx-lift" style={css('background:#fff;border:1px solid #F2E4EA;border-radius:22px;overflow:hidden;cursor:pointer;box-shadow:0 18px 40px -30px rgba(107,20,54,.55);')}>
            <div className="agx-zoom" style={css(`position:relative;aspect-ratio:16/10;background:${TONES[b.tone]};overflow:hidden;`)}>
              <ImageSlot src={b.image} placeholder={`${b.name} — cover`} style={css('position:absolute;inset:0;')} />
              <div style={css('position:absolute;inset:0;background:linear-gradient(180deg,rgba(30,8,18,0) 40%,rgba(30,8,18,.55) 100%);pointer-events:none;')} />
              {b.featured && (
                <div style={css('position:absolute;left:12px;top:12px;display:flex;align-items:center;gap:5px;background:linear-gradient(135deg,#D9B25A,#B0863B);color:#fff;padding:5px 11px;border-radius:999px;box-shadow:0 8px 20px -8px rgba(176,134,59,.8);')}>
                  <span style={css("font-family:'Material Symbols Outlined';font-size:13px;")}>workspace_premium</span>
                  <span className="agx-eyebrow" style={css('font-size:8.5px;letter-spacing:.14em;')}>Featured</span>
                </div>
              )}
              <button onClick={(e: MouseEvent) => { e.stopPropagation(); showToast('Following ' + b.name); }} style={css('position:absolute;right:12px;top:12px;width:36px;height:36px;border-radius:12px;border:none;background:rgba(255,255,255,.92);cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 14px -6px rgba(0,0,0,.3);')}>
                <span style={css("font-family:'Material Symbols Outlined';font-size:19px;color:#D6336C;")}>favorite_border</span>
              </button>
              <div style={css('position:absolute;left:14px;bottom:12px;color:#fff;')}>
                <div style={css('display:flex;align-items:center;gap:6px;')}>
                  <span style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:22px;line-height:1;text-shadow:0 2px 12px rgba(0,0,0,.4);")}>{b.name}</span>
                  {b.verified && <span style={css("font-family:'Material Symbols Outlined';font-size:17px;color:#7FC0F2;")}>verified</span>}
                </div>
              </div>
            </div>
            <div style={css('padding:14px 16px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px;')}>
              <div style={css('min-width:0;')}>
                <div style={css('color:#8A7078;font-size:12.5px;display:flex;align-items:center;gap:4px;')}>
                  <span style={css("font-family:'Material Symbols Outlined';font-size:15px;")}>location_on</span>{b.city}
                </div>
                <div style={css("font-family:'IBM Plex Mono',monospace;font-size:11px;color:#B79AA6;margin-top:4px;letter-spacing:.04em;")}>{b.products} styles</div>
              </div>
              <div style={css('display:flex;align-items:center;gap:4px;font-size:13.5px;font-weight:700;background:#FBF6F2;border:1px solid #F0E2E9;border-radius:10px;padding:6px 10px;white-space:nowrap;')}>
                <span style={css("font-family:'Material Symbols Outlined';font-size:16px;color:#E0B84B;")}>star</span>{b.rating} <span style={css('color:#B79AA6;font-weight:600;')}>· {b.reviews}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
