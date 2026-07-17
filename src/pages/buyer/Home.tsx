import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { ImageSlot } from '@/components/ui/ImageSlot';
import { useShop } from '@/state/ShopContext';
import { CATEGORIES, PRODUCTS, TONES, fmt } from '@/data/demo';

const HERO_SLIDES = [
  { slotId: 'hero-banner', tag: 'Latest Collection', pre: 'New Arrivals for ', accent: 'Wedding', post: ' Season', sub: 'Handpicked bridal edits from 200+ boutiques' },
  { slotId: 'hero-2', tag: 'Festive Edit', pre: 'Pure Silk ', accent: 'Sarees', post: '', sub: 'Direct from the Kanchipuram looms' },
  { slotId: 'hero-3', tag: 'Under ₹8,000', pre: 'Party-ready ', accent: 'Lehengas', post: '', sub: 'Ready to ship across Tamil Nadu' },
];

const reviewsF = (n: number) => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n));

export function Home() {
  const navigate = useNavigate();
  const { wishlist, toggleWish } = useShop();
  const [heroIndex, setHeroIndex] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    timer.current = setInterval(() => setHeroIndex((i) => (i + 1) % 3), 4200);
    return () => clearInterval(timer.current);
  }, []);

  // Picking a dot restarts the rotation, as in the design.
  const goHero = (i: number) => {
    setHeroIndex(i);
    clearInterval(timer.current);
    timer.current = setInterval(() => setHeroIndex((x) => (x + 1) % 3), 4200);
  };

  const goResults = () => navigate('/buyer/results');
  const openProduct = (id: string) => navigate(`/buyer/product/${id}`);

  return (
    <div style={css('min-height:100%;background:#FBF6F2;padding-bottom:20px;')}>
      {/* hero lookbook (full-bleed) */}
      <div style={css('width:100vw;margin-left:calc(50% - 50vw);')}>
        <div className="agx-zoom" style={css('position:relative;height:clamp(340px,42vw,560px);overflow:hidden;background:linear-gradient(120deg,#8E1C44,#B02454 55%,#D6336C);')}>
          <div style={css(`display:flex;height:100%;transition:transform .6s cubic-bezier(.4,0,.2,1);transform:translateX(-${heroIndex * 100}%);`)}>
            {HERO_SLIDES.map((h) => (
              <div key={h.slotId} style={css('flex:0 0 100%;position:relative;height:100%;')}>
                <div style={css('position:absolute;inset:0;')}>
                  <ImageSlot placeholder="Drop a collection photo" style={css('position:absolute;inset:0;')} />
                </div>
                <div style={css('position:absolute;inset:0;background:linear-gradient(100deg,rgba(45,8,24,.86) 0%,rgba(110,22,56,.5) 46%,rgba(110,22,56,.05) 100%);pointer-events:none;')} />
                <div style={css('position:absolute;inset:0;display:flex;align-items:center;pointer-events:none;')}>
                  <div style={css('max-width:1440px;width:100%;margin:0 auto;padding:0 clamp(20px,4vw,56px);color:#fff;')}>
                    <div style={css('max-width:560px;')}>
                      <div style={css('display:inline-flex;align-items:center;gap:7px;background:rgba(201,154,63,.2);border:1px solid rgba(226,190,120,.5);color:#F4D9A6;padding:6px 13px;border-radius:999px;backdrop-filter:blur(4px);')}>
                        <span style={css("font-family:'Material Symbols Outlined';font-size:15px;")}>auto_awesome</span>
                        <span className="agx-eyebrow" style={css('font-size:10px;')}>{h.tag}</span>
                      </div>
                      <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(38px,6vw,76px);line-height:.98;margin-top:16px;letter-spacing:-.02em;text-shadow:0 2px 30px rgba(45,8,24,.45);text-wrap:balance;")}>
                        {h.pre}<span style={css('font-style:italic;color:#F4D9A6;')}>{h.accent}</span>{h.post}
                      </div>
                      <div style={css('font-size:clamp(14px,1.4vw,17px);opacity:.9;margin-top:14px;font-weight:500;max-width:420px;text-shadow:0 1px 8px rgba(45,8,24,.5);')}>{h.sub}</div>
                      <button onClick={goResults} style={css('pointer-events:auto;margin-top:24px;background:#fff;color:#B02454;border:none;border-radius:15px;padding:14px 26px;font-weight:800;font-size:15px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;box-shadow:0 16px 36px -14px rgba(0,0,0,.5);')}>
                        Shop the edit<span style={css("font-family:'Material Symbols Outlined';font-size:19px;")}>arrow_forward</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={css('position:absolute;left:0;right:0;bottom:22px;z-index:3;')}>
            <div style={css('max-width:1440px;margin:0 auto;padding:0 clamp(20px,4vw,56px);display:flex;gap:6px;')}>
              {[0, 1, 2].map((i) => (
                <button
                  key={i}
                  onClick={() => goHero(i)}
                  style={css(`width:${i === heroIndex ? '18px' : '5px'};height:6px;border-radius:3px;border:none;padding:0;cursor:pointer;background:${i === heroIndex ? '#F4D9A6' : 'rgba(255,255,255,.55)'};transition:width .3s ease;`)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* categories */}
      <div style={css('display:flex;align-items:flex-end;justify-content:space-between;margin:34px 0 16px;')}>
        <div>
          <div className="agx-eyebrow" style={css('font-size:10.5px;color:#B02454;')}>Shop by category</div>
          <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(24px,2.6vw,34px);line-height:1.12;padding-bottom:2px;margin-top:6px;")}>Find your occasion</div>
        </div>
      </div>
      <div className="agx-scroll" style={css('display:flex;gap:16px;overflow-x:auto;padding-bottom:6px;')}>
        {CATEGORIES.map((c) => (
          <button key={c.name} onClick={goResults} className="agx-lift" style={css('flex:none;position:relative;display:flex;flex-direction:column;cursor:pointer;width:150px;border-radius:22px;padding:0;border:1px solid #F2E4EA;background:#fff;box-shadow:0 18px 40px -30px rgba(107,20,54,.5);overflow:hidden;')}>
            <div className="agx-zoom" style={css(`position:relative;width:100%;aspect-ratio:4/5;background:${c.toneHex};overflow:hidden;`)}>
              <ImageSlot placeholder={c.name} style={css('position:absolute;inset:0;')} />
              <div style={css('position:absolute;inset:0;background:linear-gradient(180deg,rgba(30,8,18,0) 45%,rgba(30,8,18,.6) 100%);pointer-events:none;')} />
              <span style={css("position:absolute;left:14px;bottom:12px;font-family:'Playfair Display',serif;font-weight:700;font-size:19px;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,.4);")}>{c.name}</span>
            </div>
          </button>
        ))}
      </div>

      {/* recommended */}
      <div style={css('display:flex;align-items:flex-end;justify-content:space-between;margin:38px 0 18px;')}>
        <div>
          <div className="agx-eyebrow" style={css('font-size:10.5px;color:#B02454;')}>Curated for you</div>
          <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(24px,2.6vw,34px);line-height:1.12;padding-bottom:2px;margin-top:6px;")}>This week&apos;s picks</div>
        </div>
        <a href="#" onClick={(e) => { e.preventDefault(); goResults(); }} className="agx-eyebrow" style={css('font-size:10px;color:#B02454;')}>See all →</a>
      </div>
      <div className="agx-scroll" style={css('display:flex;gap:18px;overflow-x:auto;padding-bottom:6px;')}>
        {PRODUCTS.map((p) => (
          <div key={p.id} onClick={() => openProduct(p.id)} className="agx-lift" style={css('flex:none;width:230px;cursor:pointer;')}>
            <div className="agx-zoom" style={css(`position:relative;aspect-ratio:3/4;border-radius:22px;overflow:hidden;background:${TONES[p.tone]};box-shadow:0 16px 34px -22px rgba(107,20,54,.6);`)}>
              <ImageSlot placeholder={p.title} style={css('position:absolute;inset:0;')} />
              {p.featured && (
                <div style={css('position:absolute;left:10px;top:10px;display:flex;align-items:center;gap:5px;background:linear-gradient(135deg,#D9B25A,#B0863B);color:#fff;padding:5px 10px;border-radius:999px;')}>
                  <span className="agx-eyebrow" style={css('font-size:8.5px;letter-spacing:.14em;')}>Featured</span>
                </div>
              )}
            </div>
            <div style={css('padding:12px 2px 0;')}>
              <div style={css('font-size:14.5px;font-weight:700;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;')}>{p.title}</div>
              <div style={css('font-size:12.5px;color:#8A7078;margin-top:2px;')}>{p.boutique}</div>
              <div style={css('display:flex;align-items:center;justify-content:space-between;margin-top:7px;')}>
                <span style={css("font-family:'Playfair Display',serif;font-weight:700;color:#B02454;font-size:19px;")}>{fmt(p.price)}</span>
                <span style={css('display:flex;align-items:center;gap:3px;font-size:12px;font-weight:700;color:#5C4650;')}>
                  <span style={css("font-family:'Material Symbols Outlined';font-size:15px;color:#E0B84B;")}>star</span>{p.rating}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* popular grid */}
      <div style={css('margin:40px 0 18px;')}>
        <div className="agx-eyebrow" style={css('font-size:10.5px;color:#B02454;')}>The lookbook</div>
        <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(24px,2.6vw,34px);line-height:1.12;padding-bottom:2px;margin-top:6px;")}>Popular right now</div>
      </div>
      <div className="agx-rgrid">
        {PRODUCTS.map((p) => (
          <div key={p.id} onClick={() => openProduct(p.id)} className="agx-lift" style={css('cursor:pointer;')}>
            <div className="agx-zoom" style={css(`position:relative;aspect-ratio:3/4;border-radius:22px;overflow:hidden;background:${TONES[p.tone]};box-shadow:0 16px 34px -22px rgba(107,20,54,.6);`)}>
              <ImageSlot placeholder={p.title} style={css('position:absolute;inset:0;')} />
              <button
                onClick={(e: MouseEvent) => { e.stopPropagation(); toggleWish(p.id); }}
                style={css('position:absolute;right:10px;top:10px;width:36px;height:36px;border-radius:12px;border:none;background:rgba(255,255,255,.9);cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 14px -6px rgba(0,0,0,.3);')}
              >
                <span style={css(`font-family:'Material Symbols Outlined';font-size:19px;color:${wishlist[p.id] ? '#D6336C' : '#B79AA6'};`)}>
                  {wishlist[p.id] ? 'favorite' : 'favorite_border'}
                </span>
              </button>
              <div style={css('position:absolute;left:10px;bottom:10px;display:flex;align-items:center;gap:4px;background:rgba(255,255,255,.96);border-radius:9px;padding:3px 8px;font-size:11px;font-weight:800;color:#241019;box-shadow:0 4px 10px rgba(0,0,0,.14);')}>
                <span style={css("font-family:'Material Symbols Outlined';font-size:13px;color:#2FA36B;")}>star</span>{p.rating}
                <span style={css('width:1px;height:10px;background:#D9C4CE;')} />
                <span style={css('color:#8A7078;')}>{reviewsF(p.reviews)}</span>
              </div>
            </div>
            <div style={css('padding:12px 2px 0;')}>
              <div style={css('font-size:14.5px;font-weight:700;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;')}>{p.title}</div>
              <div style={css("font-family:'Playfair Display',serif;font-weight:700;color:#B02454;font-size:19px;margin-top:3px;")}>{fmt(p.price)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
