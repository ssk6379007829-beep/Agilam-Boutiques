import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { css } from '@/lib/css';
import { ImageSlot } from '@/components/ui/ImageSlot';
import { useShop } from '@/state/ShopContext';
import { useCatalog } from '@/state/CatalogContext';
import { ProductReviews } from '@/components/buyer/ProductReviews';
import { TONES, fmt } from '@/data/demo';

const RATING_BARS = [
  { stars: 5, pct: 72 }, { stars: 4, pct: 19 }, { stars: 3, pct: 6 }, { stars: 2, pct: 2 }, { stars: 1, pct: 1 },
];

const reviewsF = (n: number) => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n));

const FALLBACK_SIZES = ['S', 'M', 'L', 'XL'];

// Blouse measurements in inches (unstitched saree blouse piece can be tailored to these)
const SIZE_CHART = [
  { size: 'S', bust: '32', waist: '28', shoulder: '13.5', length: '15' },
  { size: 'M', bust: '34', waist: '30', shoulder: '14', length: '15' },
  { size: 'L', bust: '36', waist: '32', shoulder: '14.5', length: '15.5' },
  { size: 'XL', bust: '38', waist: '34', shoulder: '15', length: '15.5' },
];

export function ProductDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { wishlist, toggleWish, addToCart } = useShop();
  const { products: PRODUCTS, boutiques: BOUTIQUES, loading } = useCatalog();
  const [selectedSize, setSelectedSize] = useState('M');
  const [showSizeChart, setShowSizeChart] = useState(false);
  const [openPanels, setOpenPanels] = useState<Record<string, boolean>>({ details: true });
  const togglePanel = (k: string) => setOpenPanels((p) => ({ ...p, [k]: !p[k] }));

  const ap = PRODUCTS.find((p) => p.id === id);
  if (!ap) {
    return (
      <div style={css('min-height:60vh;display:flex;align-items:center;justify-content:center;color:#8A7078;font-size:15px;')}>
        {loading ? 'Loading product…' : 'Product not found.'}
      </div>
    );
  }
  // More from the same boutique/shop
  const sameBoutique = PRODUCTS.filter((p) => p.boutique === ap.boutique && p.id !== ap.id).slice(0, 12);
  const boutiqueId = BOUTIQUES.find((x) => x.name === ap.boutique)?.id ?? '';
  // Broad "you may also like" — same category surfaced first, up to 30 items
  const youMayLike = [...PRODUCTS.filter((p) => p.id !== ap.id)]
    .sort((a, b) => (b.cat === ap.cat ? 1 : 0) - (a.cat === ap.cat ? 1 : 0))
    .slice(0, 30);

  const wishIcon = wishlist[ap.id] ? 'favorite' : 'favorite_border';
  const wishColor = wishlist[ap.id] ? '#D6336C' : '#B79AA6';

  const stockLabel = ap.stock === 0 ? 'Out of stock' : ap.stock <= 5 ? `Low · ${ap.stock} left` : 'In stock';
  const stockFg = ap.stock === 0 ? '#D6455A' : ap.stock <= 5 ? '#C99A3F' : '#2FA36B';

  const sizeOptions = ap.sizes?.length ? ap.sizes : FALLBACK_SIZES;
  const hasMrp = !!ap.mrp && ap.mrp > ap.price;
  const discountPct = hasMrp ? Math.round((1 - ap.price / (ap.mrp as number)) * 100) : null;
  const gallery = [ap.image, ...(ap.images ?? [])].filter(Boolean);

  const highlights = [
    { icon: 'diamond', label: ap.fabric || 'Premium fabric' },
    { icon: 'event_available', label: ap.occasion + ' wear' },
    { icon: 'content_cut', label: 'Handcrafted' },
  ];

  const specs = [
    { label: 'Fabric', value: ap.fabric || 'Premium fabric' },
    { label: 'Category', value: ap.cat },
    { label: 'Occasion', value: `${ap.occasion} wear` },
    { label: 'Colour', value: ap.color || '—' },
    { label: 'Wash care', value: ap.washCare || 'Dry clean only' },
    { label: 'Crafted in', value: ap.city },
    { label: 'SKU', value: ap.id.toUpperCase() },
  ];

  const thumbs = (gallery.length ? gallery : [ap.image]).slice(0, 4).map((src, i) => ({
    id: `prod-${ap.id}-t${i}`,
    src,
    ring: i === 0 ? '2px #D6336C' : '1px #EFDCE4',
  }));

  const openBoutique = () => {
    const b = BOUTIQUES.find((x) => x.name === ap.boutique);
    navigate(`/buyer/boutique/${b ? b.id : 'b1'}`);
  };
  const openChat = () => {
    const b = BOUTIQUES.find((x) => x.name === ap.boutique);
    navigate(`/buyer/chat/${b ? b.id : 'b1'}`, {
      state: {
        product: { id: ap.id, title: ap.title, price: ap.price, image: ap.image, tone: ap.tone, cat: ap.cat },
      },
    });
  };
  const onShare = async () => {
    const url = window.location.href;
    const shareData = { title: ap.title, text: `${ap.title} · ${fmt(ap.price)} on Agilam`, url };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(url);
        alert('Product link copied to clipboard');
      }
    } catch {
      /* share cancelled or unavailable */
    }
  };

  const renderPanel = (id: string, icon: string, title: string, meta: string, body: JSX.Element) => {
    const isOpen = !!openPanels[id];
    return (
      <div style={css('border:1px solid #F0E2E9;border-radius:16px;overflow:hidden;background:#fff;')}>
        <button onClick={() => togglePanel(id)} style={css('width:100%;display:flex;align-items:center;gap:12px;padding:16px 16px;border:none;background:none;cursor:pointer;text-align:left;')}>
          <span style={css("font-family:'Material Symbols Outlined';font-size:20px;color:#B02454;")}>{icon}</span>
          <span style={css('flex:1;font-weight:800;font-size:14.5px;color:#241019;')}>{title}</span>
          {meta && <span style={css('font-size:12px;color:#8A7078;font-weight:600;')}>{meta}</span>}
          <span style={css(`font-family:'Material Symbols Outlined';font-size:22px;color:#B02454;transition:transform .2s;transform:rotate(${isOpen ? 180 : 0}deg);`)}>expand_more</span>
        </button>
        {isOpen && <div style={css('padding:0 16px 18px;')}>{body}</div>}
      </div>
    );
  };

  const renderCard = (p: (typeof PRODUCTS)[number]) => {
    const liked = !!wishlist[p.id];
    return (
      <div key={p.id} onClick={() => navigate(`/buyer/product/${p.id}`)} className="agx-lift" style={css('cursor:pointer;')}>
        <div className="agx-zoom" style={css(`position:relative;aspect-ratio:3/4;border-radius:18px;overflow:hidden;background:${TONES[p.tone]};box-shadow:0 16px 34px -22px rgba(107,20,54,.55);`)}>
          <ImageSlot src={p.image} placeholder={p.title} style={css('position:absolute;inset:0;')} />
          {p.featured && (
            <div style={css('position:absolute;left:9px;top:9px;display:flex;align-items:center;gap:5px;background:linear-gradient(135deg,#D9B25A,#B0863B);color:#fff;padding:4px 9px;border-radius:999px;')}>
              <span className="agx-eyebrow" style={css('font-size:8px;letter-spacing:.14em;')}>Featured</span>
            </div>
          )}
          <button onClick={(e) => { e.stopPropagation(); toggleWish(p.id); }} style={css('position:absolute;right:9px;top:9px;width:34px;height:34px;border-radius:11px;border:none;background:rgba(255,255,255,.9);cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 20px -10px rgba(0,0,0,.4);')}>
            <span style={css(`font-family:'Material Symbols Outlined';font-size:18px;color:${liked ? '#D6336C' : '#B79AA6'};`)}>{liked ? 'favorite' : 'favorite_border'}</span>
          </button>
        </div>
        <div style={css('padding:10px 2px 0;')}>
          <div style={css('font-size:14px;font-weight:700;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;')}>{p.title}</div>
          <div style={css('font-size:12px;color:#8A7078;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;')}>{p.boutique}</div>
          <div style={css('display:flex;align-items:center;justify-content:space-between;margin-top:6px;')}>
            <span style={css("font-family:'Playfair Display',serif;font-weight:700;color:#B02454;font-size:18px;")}>{fmt(p.price)}</span>
            <span style={css('display:flex;align-items:center;gap:3px;font-size:12px;font-weight:700;color:#5C4650;')}>
              <span style={css("font-family:'Material Symbols Outlined';font-size:14px;color:#E0B84B;")}>star</span>{p.rating}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="agx-blend-root agx-pdp-root" style={css('width:100vw;margin-left:calc(50% - 50vw);min-height:100%;background:#FBF6F2;')}>
      <div style={css('max-width:1300px;margin:0 auto;padding:14px clamp(16px,4vw,44px) 0;')}>
        <div style={css('display:flex;align-items:center;gap:8px;font-size:12.5px;color:#8A7078;')}>
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/buyer/home'); }} style={css('color:#8A7078;')}>Home</a><span>/</span>
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/buyer/results'); }} style={css('color:#8A7078;')}>{ap.cat}</a><span>/</span>
          <span style={css('color:#241019;font-weight:700;')}>{ap.title}</span>
        </div>
      </div>

      <div className="agx-pdp" style={css('max-width:1300px;margin:0 auto;')}>
        <div className="agx-pdp-media" style={css('padding:clamp(16px,2.5vw,28px) 0 clamp(16px,2.5vw,28px) clamp(16px,4vw,44px);')}>
          <div className="agx-zoom" style={css(`position:relative;aspect-ratio:4/5;max-height:78vh;background:${TONES[ap.tone]};overflow:hidden;border-radius:24px;box-shadow:0 24px 54px -34px rgba(107,20,54,.5);`)}>
            <ImageSlot src={ap.image} placeholder={ap.title} style={css('position:absolute;inset:0;')} />
            <button onClick={() => navigate('/buyer/home')} style={css('position:absolute;left:16px;top:16px;width:44px;height:44px;border-radius:14px;border:none;background:rgba(255,255,255,.92);cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 26px -12px rgba(0,0,0,.4);')}>
              <span style={css("font-family:'Material Symbols Outlined';color:#B02454;")}>arrow_back</span>
            </button>
            <div style={css('position:absolute;right:16px;top:16px;display:flex;gap:10px;')}>
              <button onClick={onShare} style={css('width:44px;height:44px;border-radius:14px;border:none;background:rgba(255,255,255,.92);cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 26px -12px rgba(0,0,0,.4);')}>
                <span style={css("font-family:'Material Symbols Outlined';color:#B02454;")}>share</span>
              </button>
              <button onClick={() => toggleWish(ap.id)} style={css('width:44px;height:44px;border-radius:14px;border:none;background:rgba(255,255,255,.92);cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 26px -12px rgba(0,0,0,.4);')}>
                <span style={css(`font-family:'Material Symbols Outlined';color:${wishColor};`)}>{wishIcon}</span>
              </button>
            </div>
          </div>
          <div style={css('display:flex;gap:10px;margin-top:14px;')}>
            {thumbs.map((t) => (
              <div key={t.id} className="agx-zoom" style={css(`width:64px;height:64px;flex:none;border-radius:12px;overflow:hidden;background:${TONES[ap.tone]};box-shadow:0 0 0 ${t.ring};cursor:pointer;position:relative;`)}>
                <ImageSlot src={t.src} style={css('position:absolute;inset:0;')} />
              </div>
            ))}
          </div>
        </div>

        <div style={css('padding:clamp(20px,3vw,40px) clamp(16px,4vw,44px);display:flex;flex-direction:column;')}>
          <div className="agx-eyebrow" style={css('font-size:11px;color:#B02454;')}>{ap.cat} · {ap.occasion}</div>
          <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(30px,3.2vw,46px);line-height:1.06;letter-spacing:-.015em;margin-top:10px;padding-bottom:2px;")}>{ap.title}</div>
          <div style={css('display:flex;align-items:center;gap:14px;margin-top:12px;flex-wrap:wrap;')}>
            <div style={css("font-family:'Playfair Display',serif;font-weight:700;color:#B02454;font-size:clamp(26px,2.8vw,38px);")}>{fmt(ap.price)}</div>
            {hasMrp && (
              <>
                <span style={css('text-decoration:line-through;color:#B79AA6;font-size:16px;font-weight:700;')}>{fmt(ap.mrp as number)}</span>
                <span style={css('background:#E9F6EF;color:#2FA36B;font-size:11px;font-weight:800;padding:5px 9px;border-radius:8px;')}>{discountPct}% off</span>
              </>
            )}
            <span style={css('display:flex;align-items:center;gap:5px;font-size:13px;font-weight:700;color:#5C4650;background:#FBF6F2;border:1px solid #F0E2E9;border-radius:10px;padding:6px 10px;')}>
              <span style={css("font-family:'Material Symbols Outlined';font-size:16px;color:#E0B84B;")}>star</span>{ap.rating} <span style={css('color:#8A7078;font-weight:500;')}>· {reviewsF(ap.reviews)} reviews</span>
            </span>
            <span style={css(`font-size:12.5px;font-weight:800;color:${stockFg};`)}>{stockLabel}</span>
          </div>

          <div style={css('display:flex;flex-wrap:wrap;gap:9px;margin-top:20px;')}>
            {highlights.map((h) => (
              <span key={h.label} style={css('display:flex;align-items:center;gap:7px;background:#FBF6F2;border:1px solid #F0E2E9;border-radius:12px;padding:9px 13px;font-size:12.5px;font-weight:700;color:#4B3840;')}>
                <span style={css("font-family:'Material Symbols Outlined';font-size:17px;color:#B02454;")}>{h.icon}</span>{h.label}
              </span>
            ))}
          </div>

          <div onClick={openBoutique} className="agx-lift" style={css('display:flex;align-items:center;gap:11px;margin-top:20px;padding:13px 15px;background:#FBF6F2;border:1px solid #F0E2E9;border-radius:16px;cursor:pointer;')}>
            <div style={css("width:42px;height:42px;border-radius:12px;background:#F4D6E2;display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-weight:700;font-size:19px;color:rgba(42,26,32,.55);")}>{ap.boutique[0]}</div>
            <div style={css('flex:1;')}>
              <div style={css('display:flex;align-items:center;gap:5px;')}>
                <span style={css('font-weight:700;font-size:14.5px;')}>{ap.boutique}</span>
                <span style={css("font-family:'Material Symbols Outlined';font-size:16px;color:#3A8DD6;")}>verified</span>
              </div>
              <div style={css('color:#8A7078;font-size:12.5px;')}>{ap.city} · ★ {ap.rating}</div>
            </div>
            <span style={css("font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:600;letter-spacing:.12em;color:#B02454;")}>VISIT →</span>
          </div>

          <div style={css('display:flex;align-items:flex-start;gap:36px;margin-top:24px;flex-wrap:wrap;')}>
            <div>
              <div style={css('display:flex;align-items:center;justify-content:space-between;gap:14px;')}>
                <span className="agx-eyebrow" style={css('font-size:10px;color:#8A7078;')}>Size · {selectedSize}</span>
                <a href="#" onClick={(e) => { e.preventDefault(); setShowSizeChart(true); }} style={css('display:flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:#B02454;')}>
                  <span style={css("font-family:'Material Symbols Outlined';font-size:14px;")}>straighten</span>Size guide
                </a>
              </div>
              <div style={css('display:flex;gap:8px;margin-top:9px;flex-wrap:wrap;')}>
                {sizeOptions.map((s) => {
                  const on = selectedSize === s;
                  return (
                    <span key={s} onClick={() => setSelectedSize(s)} style={css(`width:44px;height:44px;border-radius:12px;border:1.5px solid ${on ? '#D6336C' : '#F0D8E2'};background:${on ? '#FCE0EC' : 'transparent'};color:${on ? '#B02454' : '#4B3840'};display:flex;align-items:center;justify-content:center;font-weight:${on ? 800 : 700};font-size:14px;cursor:pointer;`)}>{s}</span>
                  );
                })}
              </div>
            </div>
            {ap.color && (
              <div>
                <div className="agx-eyebrow" style={css('font-size:10px;color:#8A7078;')}>Colour</div>
                <div style={css('display:flex;align-items:center;height:44px;margin-top:9px;padding:0 16px;border-radius:12px;border:1.5px solid #F0D8E2;background:#FBF6F2;font-weight:700;font-size:14px;color:#4B3840;')}>{ap.color}</div>
              </div>
            )}
          </div>

          <div className="agx-pdp-actions" style={css('display:flex;gap:12px;margin-top:26px;flex-wrap:wrap;')}>
            <button onClick={openChat} style={css('flex:1;min-width:160px;height:56px;border:1.5px solid #D6336C;background:#fff;color:#B02454;border-radius:16px;font-weight:800;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;')}>
              <span style={css("font-family:'Material Symbols Outlined';font-size:21px;")}>chat</span>Chat
            </button>
            <button onClick={() => addToCart(ap.id)} style={css('flex:1;min-width:160px;height:56px;border:none;border-radius:16px;background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;font-weight:800;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 16px 34px -16px rgba(214,51,108,.85);')}>
              <span style={css("font-family:'Material Symbols Outlined';font-size:21px;")}>shopping_bag</span>Add to Bag
            </button>
          </div>

          {/* ACCORDION PANELS */}
          <div style={css('display:flex;flex-direction:column;gap:10px;margin-top:24px;')}>
            {renderPanel('details', 'description', 'Product details', '', (
              <>
                <div style={css('color:#5C4650;font-size:14.5px;line-height:1.65;')}>
                  {ap.description || `${ap.fabric} · ${ap.occasion} wear. Handcrafted with intricate zari work and tailored for a graceful drape.`}
                </div>
                <div style={css('margin-top:12px;border:1px solid #F0E2E9;border-radius:14px;overflow:hidden;')}>
                  {specs.map((s, i) => (
                    <div key={s.label} style={css(`display:flex;align-items:center;gap:12px;padding:11px 14px;font-size:13.5px;background:${i % 2 === 0 ? '#FBF6F2' : '#fff'};`)}>
                      <span style={css('flex:none;width:104px;color:#8A7078;font-weight:600;')}>{s.label}</span>
                      <span style={css('flex:1;color:#241019;font-weight:700;')}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ))}

            {renderPanel('delivery', 'local_shipping', 'Delivery & returns', '', (
              <div style={css('display:grid;grid-template-columns:repeat(3,1fr);gap:10px;')}>
                <div style={css('text-align:center;padding:14px 8px;background:#FBF6F2;border:1px solid #F0E2E9;border-radius:14px;')}>
                  <span style={css("font-family:'Material Symbols Outlined';font-size:22px;color:#B02454;")}>local_shipping</span>
                  <div style={css('font-size:11.5px;font-weight:700;color:#4B3840;margin-top:6px;line-height:1.3;')}>Free delivery over ₹2,000</div>
                </div>
                <div style={css('text-align:center;padding:14px 8px;background:#FBF6F2;border:1px solid #F0E2E9;border-radius:14px;')}>
                  <span style={css("font-family:'Material Symbols Outlined';font-size:22px;color:#B02454;")}>verified_user</span>
                  <div style={css('font-size:11.5px;font-weight:700;color:#4B3840;margin-top:6px;line-height:1.3;')}>Verified boutique</div>
                </div>
                <div style={css('text-align:center;padding:14px 8px;background:#FBF6F2;border:1px solid #F0E2E9;border-radius:14px;')}>
                  <span style={css("font-family:'Material Symbols Outlined';font-size:22px;color:#B02454;")}>autorenew</span>
                  <div style={css('font-size:11.5px;font-weight:700;color:#4B3840;margin-top:6px;line-height:1.3;')}>7-day easy returns</div>
                </div>
              </div>
            ))}

            {renderPanel('ratings', 'star', 'Ratings', `${ap.rating} ★`, (
              <div style={css('background:#FBF6F2;border:1px solid #F0E2E9;border-radius:16px;padding:18px;')}>
                <div style={css('display:flex;align-items:center;gap:18px;')}>
                  <div style={css('text-align:center;')}>
                    <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:44px;line-height:1;color:#B02454;")}>{ap.rating}</div>
                    <div style={css('color:#E0B84B;font-size:15px;letter-spacing:2px;margin-top:4px;')}>★★★★★</div>
                    <div style={css('color:#8A7078;font-size:12px;margin-top:6px;')}>{reviewsF(ap.reviews)} reviews</div>
                  </div>
                  <div style={css('flex:1;display:flex;flex-direction:column;gap:7px;')}>
                    {RATING_BARS.map((r) => (
                      <div key={r.stars} style={css('display:flex;align-items:center;gap:9px;')}>
                        <span style={css('font-size:11px;font-weight:700;color:#8A7078;width:10px;')}>{r.stars}</span>
                        <span style={css("font-family:'Material Symbols Outlined';font-size:13px;color:#E0B84B;")}>star</span>
                        <span style={css('flex:1;height:7px;border-radius:4px;background:#EFDCE4;overflow:hidden;')}>
                          <span style={css(`display:block;height:100%;width:${r.pct}%;background:linear-gradient(90deg,#D6336C,#B02454);border-radius:4px;`)} />
                        </span>
                        <span style={css("font-family:'IBM Plex Mono',monospace;font-size:10px;color:#8A7078;width:30px;text-align:right;")}>{r.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
                <button onClick={() => setOpenPanels((p) => ({ ...p, reviews: true }))} style={css('width:100%;margin-top:18px;height:44px;border:1.5px solid #D6336C;background:#fff;color:#B02454;border-radius:13px;font-weight:800;font-size:13.5px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;')}>
                  <span style={css("font-family:'Material Symbols Outlined';font-size:19px;")}>rate_review</span>Write a review
                </button>
              </div>
            ))}

            {renderPanel('reviews', 'reviews', 'Customer reviews', `${reviewsF(ap.reviews)}`, (
              <ProductReviews productId={ap.id} boutiqueId={boutiqueId} />
            ))}
          </div>
        </div>
      </div>

      {/* MORE FROM THIS BOUTIQUE */}
      {sameBoutique.length > 0 && (
        <div style={css('max-width:1300px;margin:0 auto;padding:clamp(20px,3vw,36px) clamp(16px,4vw,44px) 0;')}>
          <div style={css('display:flex;align-items:center;gap:12px;flex-wrap:wrap;')}>
            <div style={css("width:44px;height:44px;flex:none;border-radius:13px;background:#F4D6E2;display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-weight:700;font-size:20px;color:rgba(42,26,32,.55);")}>{ap.boutique[0]}</div>
            <div style={css('flex:1;min-width:0;')}>
              <div className="agx-eyebrow" style={css('font-size:10.5px;color:#B02454;')}>From the same shop</div>
              <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(22px,2.6vw,32px);line-height:1.08;margin-top:2px;")}>More from {ap.boutique}</div>
            </div>
            <a href="#" onClick={(e) => { e.preventDefault(); openBoutique(); }} style={css('display:flex;align-items:center;gap:5px;font-size:11px;font-weight:800;color:#B02454;border:1.5px solid #F0D8E2;border-radius:999px;padding:9px 15px;')}>
              Visit shop<span style={css("font-family:'Material Symbols Outlined';font-size:16px;")}>arrow_forward</span>
            </a>
          </div>
          <div className="agx-pgrid" style={css('gap:clamp(12px,1.8vw,20px);margin-top:20px;')}>
            {sameBoutique.map((p) => renderCard(p))}
          </div>
        </div>
      )}

      {/* YOU MAY ALSO LIKE */}
      <div style={css('max-width:1300px;margin:0 auto;padding:clamp(24px,4vw,44px) clamp(16px,4vw,44px) clamp(28px,4vw,56px);')}>
        <div>
          <div className="agx-eyebrow" style={css('font-size:10.5px;color:#B02454;')}>Complete the look</div>
          <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(26px,3vw,38px);line-height:1.06;margin-top:6px;")}>You may also like</div>
          <div style={css('color:#8A7078;font-size:13px;margin-top:6px;')}>{youMayLike.length} handpicked pieces you can explore right here — tap the heart to save any for later.</div>
        </div>
        <div className="agx-pgrid" style={css('gap:clamp(12px,1.8vw,20px);margin-top:22px;')}>
          {youMayLike.map((p) => renderCard(p))}
        </div>
      </div>

      {/* STICKY MOBILE ACTION BAR */}
      <div className="agx-pdp-sticky">
        <button onClick={openChat} style={css('flex:none;width:128px;height:52px;border:1.5px solid #ECC6D6;background:#fff;color:#B02454;border-radius:16px;font-weight:800;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;')}>
          <span style={css("font-family:'Material Symbols Outlined';font-size:20px;")}>chat</span>Chat
        </button>
        <button onClick={() => addToCart(ap.id)} style={css('flex:1;height:52px;border:none;border-radius:16px;background:linear-gradient(135deg,#E14A7E,#B02454 70%,#8E1C44);color:#fff;font-weight:800;font-size:15px;letter-spacing:.01em;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 1px 0 rgba(255,255,255,.28) inset,0 12px 26px -14px rgba(176,36,84,.9);')}>
          <span style={css("font-family:'Material Symbols Outlined';font-size:20px;")}>shopping_bag</span>Add to Bag
        </button>
      </div>

      {/* SIZE CHART MODAL */}
      {showSizeChart && (
        <div onClick={() => setShowSizeChart(false)} style={css('position:fixed;inset:0;z-index:1000;background:rgba(36,16,25,.55);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:20px;')}>
          <div onClick={(e) => e.stopPropagation()} style={css('width:100%;max-width:520px;max-height:88vh;overflow-y:auto;background:#fff;border-radius:22px;box-shadow:0 30px 70px -30px rgba(107,20,54,.6);padding:24px clamp(18px,3vw,28px);')}>
            <div style={css('display:flex;align-items:flex-start;justify-content:space-between;gap:14px;')}>
              <div>
                <div className="agx-eyebrow" style={css('font-size:10.5px;color:#B02454;')}>Fit guide</div>
                <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:24px;line-height:1.1;margin-top:4px;")}>Size chart</div>
                <div style={css('color:#8A7078;font-size:12.5px;margin-top:4px;')}>Blouse measurements in inches</div>
              </div>
              <button onClick={() => setShowSizeChart(false)} style={css('width:38px;height:38px;flex:none;border-radius:11px;border:none;background:#FBF6F2;cursor:pointer;display:flex;align-items:center;justify-content:center;')}>
                <span style={css("font-family:'Material Symbols Outlined';color:#B02454;")}>close</span>
              </button>
            </div>

            <div style={css('margin-top:18px;border:1px solid #F0E2E9;border-radius:16px;overflow:hidden;')}>
              <table style={css('width:100%;border-collapse:collapse;font-size:13px;')}>
                <thead>
                  <tr style={css('background:#FBF6F2;')}>
                    {['Size', 'Bust', 'Waist', 'Shoulder', 'Length'].map((h) => (
                      <th key={h} style={css('text-align:left;padding:11px 12px;font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#8A7078;')}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SIZE_CHART.map((r) => {
                    const on = r.size === selectedSize;
                    return (
                      <tr key={r.size} onClick={() => { setSelectedSize(r.size); setShowSizeChart(false); }} style={css(`cursor:pointer;border-top:1px solid #F0E2E9;background:${on ? '#FCE0EC' : '#fff'};`)}>
                        <td style={css(`padding:12px;font-weight:800;color:${on ? '#B02454' : '#241019'};`)}>{r.size}</td>
                        <td style={css('padding:12px;color:#4B3840;')}>{r.bust}"</td>
                        <td style={css('padding:12px;color:#4B3840;')}>{r.waist}"</td>
                        <td style={css('padding:12px;color:#4B3840;')}>{r.shoulder}"</td>
                        <td style={css('padding:12px;color:#4B3840;')}>{r.length}"</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={css('display:flex;gap:10px;margin-top:16px;padding:14px;background:#FBF6F2;border:1px solid #F0E2E9;border-radius:14px;')}>
              <span style={css("font-family:'Material Symbols Outlined';font-size:20px;color:#B02454;")}>info</span>
              <div style={css('color:#5C4650;font-size:12.5px;line-height:1.5;')}>
                Measure around the fullest part of your bust and natural waistline. If you fall between two sizes, we recommend sizing up. Need a custom fit? <a href="#" onClick={(e) => { e.preventDefault(); setShowSizeChart(false); openChat(); }} style={css('color:#B02454;font-weight:700;')}>Chat with the boutique</a>.
              </div>
            </div>

            <button onClick={() => setShowSizeChart(false)} style={css('width:100%;margin-top:16px;height:50px;border:none;border-radius:14px;background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;font-weight:800;font-size:14.5px;cursor:pointer;')}>
              Done · {selectedSize}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
