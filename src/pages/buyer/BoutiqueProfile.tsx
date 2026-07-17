import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { css } from '@/lib/css';
import { ImageSlot } from '@/components/ui/ImageSlot';
import { useShop } from '@/state/ShopContext';
import { BOUTIQUES, PRODUCTS, TONES, fmt } from '@/data/demo';

export function BoutiqueProfile() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showToast } = useShop();
  const [bqFilter, setBqFilter] = useState('All');

  const ab = BOUTIQUES.find((b) => b.id === id) ?? BOUTIQUES[0];
  const established = 2015 + (ab.id.charCodeAt(1) % 7);

  const bqCats = ['All', ...Array.from(new Set(PRODUCTS.filter((p) => p.boutique === ab.name).map((p) => p.cat)))];
  const boutiqueProducts = PRODUCTS.filter((p) => p.boutique === ab.name && (bqFilter === 'All' || p.cat === bqFilter));

  return (
    <div style={css('width:100vw;margin-left:calc(50% - 50vw);min-height:100%;background:#fff;')}>
      <div className="agx-zoom" style={css(`position:relative;height:clamp(340px,48vw,580px);background:${TONES[ab.tone]};overflow:hidden;`)}>
        <ImageSlot placeholder={`${ab.name} — cover`} style={css('position:absolute;inset:0;')} />
        <div style={css('position:absolute;inset:0;background:linear-gradient(180deg,rgba(30,8,18,.34) 0%,rgba(30,8,18,0) 26%,rgba(30,8,18,0) 42%,rgba(30,8,18,.82) 100%);pointer-events:none;')} />
        <button onClick={() => navigate('/buyer/boutiques')} style={css('position:absolute;left:clamp(16px,3vw,44px);top:22px;width:44px;height:44px;border-radius:14px;border:none;background:rgba(255,255,255,.92);cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 26px -12px rgba(0,0,0,.5);')}>
          <span style={css("font-family:'Material Symbols Outlined';color:#B02454;")}>arrow_back</span>
        </button>
        {ab.featured && (
          <div style={css('position:absolute;right:clamp(16px,3vw,44px);top:24px;display:flex;align-items:center;gap:7px;background:linear-gradient(135deg,#D9B25A,#B0863B);color:#fff;padding:8px 15px;border-radius:999px;box-shadow:0 12px 30px -12px rgba(176,134,59,.9);')}>
            <span style={css("font-family:'Material Symbols Outlined';font-size:17px;")}>workspace_premium</span>
            <span className="agx-eyebrow" style={css('font-size:10px;letter-spacing:.16em;')}>Featured Boutique</span>
          </div>
        )}
        <div className="agx-reveal" style={css('position:absolute;left:0;right:0;bottom:0;padding:clamp(22px,4vw,52px) clamp(16px,4vw,56px);color:#fff;')}>
          <div style={css('max-width:1240px;margin:0 auto;display:flex;flex-direction:column;gap:14px;')}>
            <div className="agx-eyebrow" style={css('font-size:11px;color:#F4D9A6;')}>Boutique · {ab.city}</div>
            <div style={css('display:flex;align-items:center;gap:12px;flex-wrap:wrap;')}>
              <span style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(36px,5vw,60px);line-height:1.06;letter-spacing:-.015em;text-shadow:0 2px 30px rgba(0,0,0,.35);")}>{ab.name}</span>
              {ab.verified && (
                <span style={css('display:inline-flex;align-items:center;gap:5px;background:rgba(255,255,255,.16);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.3);padding:6px 12px;border-radius:999px;font-size:12px;font-weight:700;')}>
                  <span style={css("font-family:'Material Symbols Outlined';font-size:16px;color:#7FC0F2;")}>verified</span>Verified
                </span>
              )}
            </div>
            <div style={css('display:flex;align-items:center;gap:22px;flex-wrap:wrap;')}>
              <span style={css('display:flex;align-items:center;gap:6px;font-size:15px;font-weight:600;')}>
                <span style={css("font-family:'Material Symbols Outlined';font-size:19px;color:#F4D9A6;")}>star</span>{ab.rating} <span style={css('opacity:.72;font-weight:500;')}>· {ab.reviews} reviews</span>
              </span>
              <span style={css('opacity:.72;font-size:14px;')}>{ab.products} styles</span>
              <span style={css('opacity:.72;font-size:14px;')}>Since {established}</span>
              <div style={css('display:flex;gap:10px;margin-left:auto;')}>
                <button onClick={() => navigate(`/buyer/chat/${ab.id}`)} style={css('display:flex;align-items:center;gap:7px;background:#fff;color:#B02454;border:none;border-radius:14px;padding:12px 20px;font-weight:800;font-size:14px;cursor:pointer;box-shadow:0 14px 34px -14px rgba(0,0,0,.5);')}>
                  <span style={css("font-family:'Material Symbols Outlined';font-size:19px;")}>chat</span>Chat
                </button>
                <button onClick={() => showToast('Following ' + ab.name)} style={css('display:flex;align-items:center;gap:7px;background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;border:none;border-radius:14px;padding:12px 22px;font-weight:800;font-size:14px;cursor:pointer;box-shadow:0 14px 34px -14px rgba(214,51,108,.9);')}>
                  <span style={css("font-family:'Material Symbols Outlined';font-size:19px;")}>favorite</span>Follow
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={css('max-width:1240px;margin:0 auto;padding:clamp(24px,4vw,44px) clamp(16px,4vw,44px) 40px;')}>
        <div style={css('display:flex;flex-wrap:wrap;gap:12px;align-items:stretch;')}>
          <button onClick={() => showToast('Opening Instagram → @' + ab.insta)} style={css('flex:1;min-width:220px;display:flex;align-items:center;gap:13px;padding:14px 16px;border:1px solid #F0D8E2;border-radius:18px;background:#fff;cursor:pointer;text-align:left;box-shadow:0 12px 30px -24px rgba(107,20,54,.6);')}>
            <span style={css('width:44px;height:44px;border-radius:13px;flex:none;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#F58529,#DD2A7B 55%,#8134AF);')}>
              <span style={css("font-family:'Material Symbols Outlined';color:#fff;font-size:24px;")}>photo_camera</span>
            </span>
            <span style={css('flex:1;min-width:0;')}>
              <span style={css('display:block;font-weight:800;font-size:14px;color:#241019;')}>@{ab.insta}</span>
              <span style={css('display:block;font-size:12px;color:#8A7078;margin-top:1px;')}>View on Instagram</span>
            </span>
            <span style={css("font-family:'Material Symbols Outlined';color:#C99;font-size:20px;")}>open_in_new</span>
          </button>
          <button onClick={() => showToast('Opening map → ' + ab.area)} style={css('flex:1;min-width:220px;display:flex;align-items:center;gap:13px;padding:14px 16px;border:1px solid #F0D8E2;border-radius:18px;background:#fff;cursor:pointer;text-align:left;box-shadow:0 12px 30px -24px rgba(107,20,54,.6);')}>
            <span style={css('width:44px;height:44px;border-radius:13px;flex:none;display:flex;align-items:center;justify-content:center;background:#FCE0EC;')}>
              <span style={css("font-family:'Material Symbols Outlined';color:#B02454;font-size:24px;")}>location_on</span>
            </span>
            <span style={css('flex:1;min-width:0;')}>
              <span style={css('display:block;font-weight:800;font-size:14px;color:#241019;')}>{ab.area}</span>
              <span style={css('display:block;font-size:12px;color:#8A7078;margin-top:1px;')}>Get directions</span>
            </span>
            <span style={css("font-family:'Material Symbols Outlined';color:#C99;font-size:20px;")}>near_me</span>
          </button>
        </div>

        <div style={css('display:grid;grid-template-columns:1fr;gap:20px;margin-top:24px;')}>
          <p style={css("color:#5C4650;font-size:clamp(15px,1.4vw,18px);line-height:1.65;max-width:720px;margin:0;font-family:'Playfair Display',serif;font-style:italic;")}>{ab.desc}</p>
        </div>

        <div style={css('display:flex;align-items:flex-end;justify-content:space-between;margin-top:38px;flex-wrap:wrap;gap:12px;')}>
          <div>
            <div className="agx-eyebrow" style={css('font-size:11px;color:#B02454;')}>The Collection</div>
            <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(26px,3vw,38px);line-height:1.1;padding-bottom:2px;margin-top:6px;")}>Latest arrivals</div>
          </div>
          <span style={css('color:#8A7078;font-size:13.5px;font-weight:600;')}>{ab.products} styles</span>
        </div>

        <div style={css('display:flex;gap:9px;overflow-x:auto;padding:16px 0 4px;scrollbar-width:none;')}>
          {bqCats.map((c) => {
            const on = bqFilter === c;
            return (
              <button key={c} onClick={() => setBqFilter(c)} style={css(`flex:none;border:1.5px solid ${on ? '#B02454' : '#F0D8E2'};background:${on ? '#B02454' : '#fff'};color:${on ? '#fff' : '#6B5560'};border-radius:999px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;font-family:inherit;`)}>
                {c}
              </button>
            );
          })}
        </div>

        <div className="agx-rgrid" style={css('margin-top:22px;')}>
          {boutiqueProducts.map((p) => (
            <div key={p.id} onClick={() => navigate(`/buyer/product/${p.id}`)} className="agx-lift agx-reveal" style={css('cursor:pointer;')}>
              <div className="agx-zoom" style={css(`position:relative;aspect-ratio:3/4;border-radius:20px;overflow:hidden;background:${TONES[p.tone]};box-shadow:0 16px 34px -22px rgba(107,20,54,.6);`)}>
                <ImageSlot placeholder={p.title} style={css('position:absolute;inset:0;')} />
                <div style={css('position:absolute;left:10px;bottom:10px;display:flex;align-items:center;gap:4px;background:rgba(255,255,255,.96);border-radius:9px;padding:3px 8px;font-size:11px;font-weight:800;color:#241019;box-shadow:0 4px 10px rgba(0,0,0,.14);')}>
                  <span style={css("font-family:'Material Symbols Outlined';font-size:13px;color:#2FA36B;")}>star</span>{p.rating}
                </div>
              </div>
              <div style={css('padding:11px 2px 0;')}>
                <div style={css('font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;')}>{p.title}</div>
                <div style={css("font-family:'Playfair Display',serif;font-weight:700;color:#B02454;font-size:19px;margin-top:2px;")}>{fmt(p.price)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
