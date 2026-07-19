import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { ImageSlot } from '@/components/ui/ImageSlot';
import { useShop } from '@/state/ShopContext';
import { useCatalog } from '@/state/CatalogContext';
import { CATEGORIES, HOME_REVIEWS, TONES, fmt, img } from '@/data/demo';

const HERO_SLIDES = [
  { slotId: 'hero-banner', tag: 'Latest Collection', pre: 'New Arrivals for ', accent: 'Wedding', post: ' Season', sub: 'Handpicked bridal edits from 200+ boutiques', image: img('1602210901882-071c6b9e239d', 1600) },
  { slotId: 'hero-2', tag: 'Festive Edit', pre: 'Pure Silk ', accent: 'Sarees', post: '', sub: 'Direct from the Kanchipuram looms', image: img('1601571115502-83ca3095735b', 1600) },
  { slotId: 'hero-3', tag: 'Under ₹8,000', pre: 'Party-ready ', accent: 'Lehengas', post: '', sub: 'Ready to ship across Tamil Nadu', image: img('1601432093209-8af1fd74b054', 1600) },
];

const reviewsF = (n: number) => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n));
const starRow = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

/** Initials for a boutique's logo badge: "Elegance Boutique" -> "EB". */
const monogram = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.slice(0, 2).map((w) => w[0]).join('') || name.slice(0, 2)).toUpperCase();
};

export function Home() {
  const navigate = useNavigate();
  const { wishlist, toggleWish } = useShop();
  const { products: PRODUCTS, boutiques: BOUTIQUES } = useCatalog();

  // Home shows a curated slice of the catalogue in each rail.
  const NEW_ARRIVALS = PRODUCTS.slice(0, 5);
  const BEST_SELLERS = [...PRODUCTS].sort((a, b) => b.reviews - a.reviews).slice(0, 6);
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
  const goBoutiques = () => navigate('/buyer/boutiques');
  const openProduct = (id: string) => navigate(`/buyer/product/${id}`);
  const openBoutique = (id: string) => navigate(`/buyer/boutique/${id}`);

  return (
    <div style={css('min-height:100%;background:#FBF6F2;')}>
      {/* hero lookbook (full-bleed) */}
      <div style={css('width:100vw;margin-left:calc(50% - 50vw);')}>
        <div className="agx-zoom" style={css('position:relative;height:clamp(340px,42vw,560px);overflow:hidden;background:linear-gradient(120deg,#8E1C44,#B02454 55%,#D6336C);')}>
          <div style={css(`display:flex;height:100%;transition:transform .6s cubic-bezier(.4,0,.2,1);transform:translateX(-${heroIndex * 100}%);`)}>
            {HERO_SLIDES.map((h) => (
              <div key={h.slotId} style={css('flex:0 0 100%;position:relative;height:100%;')}>
                <div style={css('position:absolute;inset:0;')}>
                  <ImageSlot src={h.image} placeholder="Drop a collection photo" style={css('position:absolute;inset:0;')} />
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

      {/* NEW ARRIVALS */}
      <div style={css('display:flex;align-items:flex-end;justify-content:space-between;margin:34px 0 16px;')}>
        <div>
          <div className="agx-eyebrow" style={css('font-size:10.5px;color:#B02454;')}>Fresh off the loom</div>
          <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(24px,2.6vw,34px);line-height:1.12;padding-bottom:2px;margin-top:6px;")}>New arrivals</div>
        </div>
        <a href="#" onClick={(e) => { e.preventDefault(); goResults(); }} className="agx-eyebrow" style={css('font-size:10px;color:#B02454;')}>See all →</a>
      </div>
      <div className="agx-scroll" style={css('display:flex;gap:18px;overflow-x:auto;padding-bottom:6px;')}>
        {NEW_ARRIVALS.map((p) => (
          <div key={p.id} onClick={() => openProduct(p.id)} className="agx-lift" style={css('flex:none;width:230px;cursor:pointer;')}>
            <div className="agx-zoom" style={css(`position:relative;aspect-ratio:3/4;border-radius:22px;overflow:hidden;background:${TONES[p.tone]};box-shadow:0 16px 34px -22px rgba(107,20,54,.6);`)}>
              <ImageSlot src={p.image} placeholder={p.title} style={css('position:absolute;inset:0;')} />
              <div style={css('position:absolute;left:10px;top:10px;display:flex;align-items:center;gap:5px;background:rgba(255,255,255,.94);color:#B02454;padding:5px 10px;border-radius:999px;box-shadow:0 4px 12px rgba(0,0,0,.14);')}>
                <span style={css("font-family:'Material Symbols Outlined';font-size:13px;")}>fiber_new</span>
                <span className="agx-eyebrow" style={css('font-size:8.5px;letter-spacing:.14em;')}>New</span>
              </div>
              <button onClick={(e: MouseEvent) => { e.stopPropagation(); toggleWish(p.id); }} style={css('position:absolute;right:10px;top:10px;width:36px;height:36px;border-radius:12px;border:none;background:rgba(255,255,255,.9);cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 14px -6px rgba(0,0,0,.3);')}>
                <span style={css(`font-family:'Material Symbols Outlined';font-size:19px;color:${wishlist[p.id] ? '#D6336C' : '#B79AA6'};`)}>{wishlist[p.id] ? 'favorite' : 'favorite_border'}</span>
              </button>
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

      {/* SHOP BY COLLECTION */}
      <div style={css('display:flex;align-items:flex-end;justify-content:space-between;margin:40px 0 16px;')}>
        <div>
          <div className="agx-eyebrow" style={css('font-size:10.5px;color:#B02454;')}>Browse every edit</div>
          <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(24px,2.6vw,34px);line-height:1.12;padding-bottom:2px;margin-top:6px;")}>Shop by collection</div>
        </div>
        <a href="#" onClick={(e) => { e.preventDefault(); goResults(); }} className="agx-eyebrow" style={css('font-size:10px;color:#B02454;')}>View all →</a>
      </div>
      <div className="agx-scroll" style={css('display:flex;gap:16px;overflow-x:auto;padding-bottom:6px;')}>
        {CATEGORIES.map((c) => (
          <button key={c.name} onClick={goResults} className="agx-lift" style={css('flex:none;position:relative;display:flex;flex-direction:column;cursor:pointer;width:160px;border-radius:22px;padding:0;border:1px solid #F2E4EA;background:#fff;box-shadow:0 18px 40px -30px rgba(107,20,54,.5);overflow:hidden;')}>
            <div className="agx-zoom" style={css(`position:relative;width:100%;aspect-ratio:4/5;background:${c.toneHex};overflow:hidden;`)}>
              <ImageSlot src={c.image} placeholder={c.name} style={css('position:absolute;inset:0;')} />
              <div style={css('position:absolute;inset:0;background:linear-gradient(180deg,rgba(30,8,18,0) 42%,rgba(30,8,18,.68) 100%);pointer-events:none;')} />
              <div style={css('position:absolute;left:14px;bottom:12px;display:flex;align-items:center;gap:7px;')}>
                <span style={css("font-family:'Material Symbols Outlined';font-size:19px;color:#F4D9A6;")}>{c.icon}</span>
                <span style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:19px;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,.45);")}>{c.name}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* BEST SELLERS */}
      <div style={css('display:flex;align-items:flex-end;justify-content:space-between;margin:40px 0 18px;')}>
        <div>
          <div className="agx-eyebrow" style={css('font-size:10.5px;color:#B02454;')}>Most-loved right now</div>
          <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(24px,2.6vw,34px);line-height:1.12;padding-bottom:2px;margin-top:6px;")}>Best sellers</div>
        </div>
        <a href="#" onClick={(e) => { e.preventDefault(); goResults(); }} className="agx-eyebrow" style={css('font-size:10px;color:#B02454;')}>See all →</a>
      </div>
      <div className="agx-rgrid">
        {BEST_SELLERS.map((p) => (
          <div key={p.id} onClick={() => openProduct(p.id)} className="agx-lift" style={css('cursor:pointer;')}>
            <div className="agx-zoom" style={css(`position:relative;aspect-ratio:3/4;border-radius:22px;overflow:hidden;background:${TONES[p.tone]};box-shadow:0 16px 34px -22px rgba(107,20,54,.6);`)}>
              <ImageSlot src={p.image} placeholder={p.title} style={css('position:absolute;inset:0;')} />
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

      {/* BEST-SELLING BOUTIQUES */}
      <div style={css('display:flex;align-items:flex-end;justify-content:space-between;margin:40px 0 16px;')}>
        <div>
          <div className="agx-eyebrow" style={css('font-size:10.5px;color:#B02454;')}>Shops buyers love</div>
          <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(24px,2.6vw,34px);line-height:1.12;padding-bottom:2px;margin-top:6px;")}>Best-selling boutiques</div>
        </div>
        <a href="#" onClick={(e) => { e.preventDefault(); goBoutiques(); }} className="agx-eyebrow" style={css('font-size:10px;color:#B02454;')}>View all →</a>
      </div>
      <div className="agx-scroll" style={css('display:flex;gap:18px;overflow-x:auto;padding-bottom:6px;')}>
        {BOUTIQUES.map((b) => (
          <div key={b.id} onClick={() => openBoutique(b.id)} className="agx-lift" style={css('flex:none;width:300px;background:#fff;border:1px solid #F2E4EA;border-radius:22px;overflow:hidden;cursor:pointer;box-shadow:0 18px 40px -30px rgba(107,20,54,.55);')}>
            {/* Cover — image only, no name overlay */}
            <div className="agx-zoom" style={css(`position:relative;aspect-ratio:16/10;background:${TONES[b.tone]};overflow:hidden;`)}>
              <ImageSlot src={b.image} placeholder={`${b.name} — cover`} style={css('position:absolute;inset:0;')} />
            </div>
            {/* Identity — logo + name shown separately below the cover */}
            <div style={css('padding:14px 16px 16px;')}>
              <div style={css('display:flex;align-items:center;gap:11px;')}>
                <div style={css('width:44px;height:44px;flex:none;border-radius:50%;background:linear-gradient(135deg,#D6336C,#8E1E43);display:flex;align-items:center;justify-content:center;box-shadow:0 10px 22px -12px rgba(214,51,108,.9);')}>
                  <span style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:16px;color:#fff;letter-spacing:.02em;")}>{monogram(b.name)}</span>
                </div>
                <div style={css('min-width:0;flex:1;')}>
                  <div style={css('display:flex;align-items:center;gap:5px;')}>
                    <span style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:17px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;")}>{b.name}</span>
                    {b.verified && <span style={css("font-family:'Material Symbols Outlined';font-size:16px;color:#3A9BE0;flex:none;")}>verified</span>}
                  </div>
                  <div style={css('color:#8A7078;font-size:12px;display:flex;align-items:center;gap:3px;margin-top:2px;')}>
                    <span style={css("font-family:'Material Symbols Outlined';font-size:14px;")}>location_on</span>{b.city}
                  </div>
                </div>
              </div>
              <div style={css('display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:13px;padding-top:12px;border-top:1px solid #F4E6EC;')}>
                <div style={css("font-family:'IBM Plex Mono',monospace;font-size:11px;color:#B79AA6;letter-spacing:.04em;")}>{b.products} styles</div>
                <div style={css('display:flex;align-items:center;gap:4px;font-size:13px;font-weight:700;background:#FBF6F2;border:1px solid #F0E2E9;border-radius:10px;padding:5px 10px;white-space:nowrap;')}>
                  <span style={css("font-family:'Material Symbols Outlined';font-size:16px;color:#E0B84B;")}>star</span>{b.rating} <span style={css('color:#B79AA6;font-weight:600;')}>· {b.reviews}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CUSTOMER REVIEWS (full-bleed) */}
      <div style={css('width:100vw;margin-left:calc(50% - 50vw);background:#FBF6F2;margin-top:44px;')}>
        <div style={css('max-width:1440px;margin:0 auto;padding:clamp(34px,4vw,60px) clamp(20px,4vw,56px);')}>
          <div style={css('text-align:center;max-width:560px;margin:0 auto;')}>
            <div className="agx-eyebrow" style={css('font-size:10.5px;color:#B02454;')}>Loved across Tamil Nadu</div>
            <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(26px,3vw,40px);line-height:1.08;margin-top:6px;")}>What shoppers say about Agilam</div>
          </div>
          <div className="agx-rgrid" style={css('margin-top:30px;')}>
            {HOME_REVIEWS.map((r) => (
              <div key={r.name} style={css('background:#fff;border:1px solid #F0E2E9;border-radius:20px;padding:24px 22px;box-shadow:0 18px 44px -34px rgba(107,20,54,.5);display:flex;flex-direction:column;')}>
                <div style={css('color:#E0B84B;font-size:16px;letter-spacing:2px;')}>{starRow(r.rating)}</div>
                <div style={css('font-size:14.5px;line-height:1.6;color:#3F2E36;margin-top:12px;text-wrap:pretty;')}>“{r.text}”</div>
                <div style={css('display:flex;align-items:center;gap:12px;margin-top:18px;')}>
                  <div style={css(`width:42px;height:42px;flex:none;border-radius:50%;background:${TONES[r.tone]};display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-weight:700;font-size:18px;color:#5C1E38;`)}>{r.name[0]}</div>
                  <div>
                    <div style={css('font-size:14px;font-weight:800;color:#241019;')}>{r.name}</div>
                    <div style={css('font-size:12px;color:#8A7078;display:flex;align-items:center;gap:3px;')}>
                      <span style={css("font-family:'Material Symbols Outlined';font-size:13px;")}>location_on</span>{r.city}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FOOTER (full-bleed) */}
      <div style={css('width:100vw;margin-left:calc(50% - 50vw);margin-top:44px;background:linear-gradient(140deg,#5C1330,#8E1C44 60%,#B02454);color:#fff;')}>
        <div style={css('max-width:1440px;margin:0 auto;padding:clamp(40px,5vw,64px) clamp(20px,4vw,56px) 28px;')}>
          <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:36px;')}>
            <div style={css('max-width:320px;')}>
              <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:26px;letter-spacing:-.01em;")}>Agilam</div>
              <div style={css('font-size:13.5px;line-height:1.6;opacity:.82;margin-top:10px;')}>Tamil Nadu's home for local boutiques. Discover, chat and shop verified stores — all in one place.</div>
              <div style={css('display:flex;gap:10px;margin-top:18px;')}>
                {['photo_camera', 'chat', 'mail'].map((ic) => (
                  <span key={ic} style={css('width:40px;height:40px;border-radius:12px;background:rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center;')}>
                    <span style={css("font-family:'Material Symbols Outlined';font-size:20px;color:#F4D9A6;")}>{ic}</span>
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="agx-eyebrow" style={css('font-size:10px;color:#F4D9A6;')}>Shop</div>
              <div style={css('display:flex;flex-direction:column;gap:11px;margin-top:16px;font-size:13.5px;opacity:.88;')}>
                <a href="#" onClick={(e) => { e.preventDefault(); goResults(); }} style={css('color:#fff;')}>New arrivals</a>
                <a href="#" onClick={(e) => { e.preventDefault(); goResults(); }} style={css('color:#fff;')}>Best sellers</a>
                <a href="#" onClick={(e) => { e.preventDefault(); goBoutiques(); }} style={css('color:#fff;')}>Boutiques</a>
                <a href="#" onClick={(e) => { e.preventDefault(); goResults(); }} style={css('color:#fff;')}>Collections</a>
              </div>
            </div>
            <div>
              <div className="agx-eyebrow" style={css('font-size:10px;color:#F4D9A6;')}>Company</div>
              <div style={css('display:flex;flex-direction:column;gap:11px;margin-top:16px;font-size:13.5px;opacity:.88;')}>
                <a href="#" onClick={(e) => e.preventDefault()} style={css('color:#fff;')}>About Agilam</a>
                <a href="#" onClick={(e) => e.preventDefault()} style={css('color:#fff;')}>Sell on Agilam</a>
                <a href="#" onClick={(e) => e.preventDefault()} style={css('color:#fff;')}>Careers</a>
                <a href="#" onClick={(e) => e.preventDefault()} style={css('color:#fff;')}>Contact</a>
              </div>
            </div>
            <div>
              <div className="agx-eyebrow" style={css('font-size:10px;color:#F4D9A6;')}>Help</div>
              <div style={css('display:flex;flex-direction:column;gap:11px;margin-top:16px;font-size:13.5px;opacity:.88;')}>
                <a href="#" onClick={(e) => { e.preventDefault(); navigate('/buyer/orders'); }} style={css('color:#fff;')}>Track order</a>
                <a href="#" onClick={(e) => e.preventDefault()} style={css('color:#fff;')}>Returns &amp; refunds</a>
                <a href="#" onClick={(e) => e.preventDefault()} style={css('color:#fff;')}>Shipping</a>
                <a href="#" onClick={(e) => e.preventDefault()} style={css('color:#fff;')}>FAQ</a>
              </div>
            </div>
          </div>
          <div style={css('border-top:1px solid rgba(255,255,255,.15);margin-top:36px;padding-top:20px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;font-size:12.5px;opacity:.75;')}>
            <span>© 2026 Agilam Boutiques. Made in Tamil Nadu.</span>
            <span style={css('display:flex;gap:18px;')}><a href="#" onClick={(e) => e.preventDefault()} style={css('color:#fff;')}>Privacy</a><a href="#" onClick={(e) => e.preventDefault()} style={css('color:#fff;')}>Terms</a></span>
          </div>
        </div>
      </div>
    </div>
  );
}
