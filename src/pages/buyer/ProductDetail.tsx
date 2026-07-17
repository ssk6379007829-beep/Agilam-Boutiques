import { useNavigate, useParams } from 'react-router-dom';
import { css } from '@/lib/css';
import { ImageSlot } from '@/components/ui/ImageSlot';
import { useShop } from '@/state/ShopContext';
import { BOUTIQUES, PRODUCTS, TONES, fmt } from '@/data/demo';

const RATING_BARS = [
  { stars: 5, pct: 72 }, { stars: 4, pct: 19 }, { stars: 3, pct: 6 }, { stars: 2, pct: 2 }, { stars: 1, pct: 1 },
];

const REVIEWS = [
  { name: 'Anitha R.', rating: 5, date: '2 weeks ago', text: 'The zari work is even more stunning in person. The drape fell beautifully at my sister’s wedding — so many compliments.', tone: 0, verified: true },
  { name: 'Meena K.', rating: 5, date: '1 month ago', text: 'Rich colour and premium silk. The boutique answered all my questions on WhatsApp before I ordered. Highly recommend.', tone: 2, verified: true },
  { name: 'Divya S.', rating: 4, date: '1 month ago', text: 'Lovely saree and true to the photos. Delivery took a little longer than expected but the quality made up for it.', tone: 4, verified: false },
];

const reviewsF = (n: number) => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n));
const starsFor = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

export function ProductDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { wishlist, toggleWish, addToCart, buyNow } = useShop();

  const ap = PRODUCTS.find((p) => p.id === id) ?? PRODUCTS[0];
  const related = PRODUCTS.filter((p) => p.id !== ap.id).slice(0, 5);

  const wishIcon = wishlist[ap.id] ? 'favorite' : 'favorite_border';
  const wishColor = wishlist[ap.id] ? '#D6336C' : '#B79AA6';

  const stockLabel = ap.stock === 0 ? 'Out of stock' : ap.stock <= 5 ? `Low · ${ap.stock} left` : 'In stock';
  const stockFg = ap.stock === 0 ? '#D6455A' : ap.stock <= 5 ? '#C99A3F' : '#2FA36B';

  const highlights = [
    { icon: 'diamond', label: ap.fabric || 'Premium fabric' },
    { icon: 'event_available', label: ap.occasion + ' wear' },
    { icon: 'content_cut', label: 'Handcrafted' },
  ];

  const thumbs = [0, 1, 2, 3].map((i) => ({
    id: `prod-${ap.id}-t${i}`,
    toneHex: TONES[(ap.tone + i) % TONES.length],
    ring: i === 0 ? '2px #D6336C' : '1px #EFDCE4',
  }));

  const openBoutique = () => {
    const b = BOUTIQUES.find((x) => x.name === ap.boutique);
    navigate(`/buyer/boutique/${b ? b.id : 'b1'}`);
  };
  const openChat = () => {
    const b = BOUTIQUES.find((x) => x.name === ap.boutique);
    navigate(`/buyer/chat/${b ? b.id : 'b1'}`);
  };
  const onBuyNow = () => { buyNow(ap.id); navigate('/buyer/cart'); };

  return (
    <div className="agx-blend-root" style={css('width:100vw;margin-left:calc(50% - 50vw);min-height:100%;background:#FBF6F2;')}>
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
            <ImageSlot placeholder={ap.title} style={css('position:absolute;inset:0;')} />
            <button onClick={() => navigate('/buyer/home')} style={css('position:absolute;left:16px;top:16px;width:44px;height:44px;border-radius:14px;border:none;background:rgba(255,255,255,.92);cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 26px -12px rgba(0,0,0,.4);')}>
              <span style={css("font-family:'Material Symbols Outlined';color:#B02454;")}>arrow_back</span>
            </button>
            <button onClick={() => toggleWish(ap.id)} style={css('position:absolute;right:16px;top:16px;width:44px;height:44px;border-radius:14px;border:none;background:rgba(255,255,255,.92);cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 26px -12px rgba(0,0,0,.4);')}>
              <span style={css(`font-family:'Material Symbols Outlined';color:${wishColor};`)}>{wishIcon}</span>
            </button>
            {ap.featured && (
              <div style={css('position:absolute;left:16px;bottom:16px;display:flex;align-items:center;gap:6px;background:linear-gradient(135deg,#D9B25A,#B0863B);color:#fff;padding:7px 13px;border-radius:999px;box-shadow:0 12px 30px -12px rgba(176,134,59,.9);')}>
                <span style={css("font-family:'Material Symbols Outlined';font-size:15px;")}>workspace_premium</span>
                <span className="agx-eyebrow" style={css('font-size:9.5px;letter-spacing:.16em;')}>Featured</span>
              </div>
            )}
          </div>
          <div style={css('display:flex;gap:12px;margin-top:14px;')}>
            {thumbs.map((t) => (
              <div key={t.id} className="agx-zoom" style={css(`flex:1;aspect-ratio:1;border-radius:14px;overflow:hidden;background:${t.toneHex};box-shadow:0 0 0 ${t.ring};cursor:pointer;position:relative;`)}>
                <ImageSlot style={css('position:absolute;inset:0;')} />
              </div>
            ))}
          </div>
        </div>

        <div style={css('padding:clamp(20px,3vw,40px) clamp(16px,4vw,44px);display:flex;flex-direction:column;')}>
          <div className="agx-eyebrow" style={css('font-size:11px;color:#B02454;')}>{ap.cat} · {ap.occasion}</div>
          <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(30px,3.2vw,46px);line-height:1.06;letter-spacing:-.015em;margin-top:10px;padding-bottom:2px;")}>{ap.title}</div>
          <div style={css('display:flex;align-items:center;gap:14px;margin-top:12px;flex-wrap:wrap;')}>
            <div style={css("font-family:'Playfair Display',serif;font-weight:700;color:#B02454;font-size:clamp(26px,2.8vw,38px);")}>{fmt(ap.price)}</div>
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
                <span className="agx-eyebrow" style={css('font-size:10px;color:#8A7078;')}>Size</span>
                <a href="#" onClick={(e) => e.preventDefault()} style={css('font-size:11px;font-weight:700;color:#B02454;')}>Size guide</a>
              </div>
              <div style={css('display:flex;gap:8px;margin-top:9px;')}>
                <span style={css('width:44px;height:44px;border-radius:12px;border:1.5px solid #F0D8E2;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;cursor:pointer;')}>S</span>
                <span style={css('width:44px;height:44px;border-radius:12px;border:1.5px solid #D6336C;background:#FCE0EC;color:#B02454;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;cursor:pointer;')}>M</span>
                <span style={css('width:44px;height:44px;border-radius:12px;border:1.5px solid #F0D8E2;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;cursor:pointer;')}>L</span>
              </div>
            </div>
            <div>
              <div className="agx-eyebrow" style={css('font-size:10px;color:#8A7078;')}>Colour</div>
              <div style={css('display:flex;gap:9px;margin-top:9px;')}>
                <span style={css('width:40px;height:40px;border-radius:50%;background:#E7719F;box-shadow:0 0 0 2px #fff,0 0 0 4px #D6336C;cursor:pointer;')} />
                <span style={css('width:40px;height:40px;border-radius:50%;background:#9B7FC7;cursor:pointer;')} />
                <span style={css('width:40px;height:40px;border-radius:50%;background:#5FA37E;cursor:pointer;')} />
              </div>
            </div>
          </div>

          <div className="agx-eyebrow" style={css('font-size:10px;color:#8A7078;margin-top:26px;')}>Details</div>
          <div style={css('color:#5C4650;font-size:15px;line-height:1.65;margin-top:8px;')}>
            {ap.fabric} · {ap.occasion} wear. Handcrafted with intricate zari work and tailored for a graceful drape. Blouse fabric included.
          </div>

          <div style={css('display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:22px;')}>
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

          <div style={css('display:flex;gap:12px;margin-top:26px;flex-wrap:wrap;')}>
            <button onClick={() => addToCart(ap.id)} style={css('flex:1;min-width:160px;height:56px;border:none;border-radius:16px;background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;font-weight:800;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 16px 34px -16px rgba(214,51,108,.85);')}>
              <span style={css("font-family:'Material Symbols Outlined';font-size:21px;")}>add_shopping_cart</span>Add to Cart
            </button>
            <button onClick={onBuyNow} style={css('flex:1;min-width:160px;height:56px;border:1.5px solid #D6336C;background:#fff;color:#B02454;border-radius:16px;font-weight:800;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;')}>
              <span style={css("font-family:'Material Symbols Outlined';font-size:21px;")}>bolt</span>Buy Now
            </button>
          </div>
          <div style={css('display:flex;gap:12px;margin-top:12px;flex-wrap:wrap;')}>
            <button onClick={openChat} style={css('flex:1;min-width:140px;height:52px;border:1.5px solid #F0D8E2;background:#fff;color:#4B3840;border-radius:16px;font-weight:800;font-size:14.5px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;')}>
              <span style={css("font-family:'Material Symbols Outlined';font-size:20px;color:#B02454;")}>chat</span>Chat
            </button>
            <button onClick={() => toggleWish(ap.id)} style={css('flex:1;min-width:140px;height:52px;border:1.5px solid #F0D8E2;background:#fff;color:#4B3840;border-radius:16px;font-weight:800;font-size:14.5px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;')}>
              <span style={css(`font-family:'Material Symbols Outlined';font-size:20px;color:${wishColor};`)}>{wishIcon}</span>Wishlist
            </button>
          </div>
        </div>
      </div>

      {/* REVIEWS */}
      <div style={css('max-width:1300px;margin:0 auto;padding:clamp(24px,4vw,52px) clamp(16px,4vw,44px);border-top:1px solid #F0E2E9;')}>
        <div className="agx-eyebrow" style={css('font-size:10.5px;color:#B02454;')}>What buyers say</div>
        <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(26px,3vw,38px);line-height:1.06;margin-top:6px;")}>Ratings &amp; reviews</div>
        <div className="agx-reviews" style={css('display:grid;gap:clamp(20px,3vw,40px);margin-top:24px;align-items:start;')}>
          <div style={css('background:#FBF6F2;border:1px solid #F0E2E9;border-radius:20px;padding:24px;')}>
            <div style={css('display:flex;align-items:center;gap:18px;')}>
              <div style={css('text-align:center;')}>
                <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:52px;line-height:1;color:#B02454;")}>{ap.rating}</div>
                <div style={css('color:#E0B84B;font-size:16px;letter-spacing:2px;margin-top:4px;')}>★★★★★</div>
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
            <button onClick={openChat} style={css('width:100%;margin-top:20px;height:46px;border:1.5px solid #D6336C;background:#fff;color:#B02454;border-radius:13px;font-weight:800;font-size:13.5px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;')}>
              <span style={css("font-family:'Material Symbols Outlined';font-size:19px;")}>rate_review</span>Write a review
            </button>
          </div>

          <div style={css('display:flex;flex-direction:column;gap:14px;')}>
            {REVIEWS.map((rv) => (
              <div key={rv.name} style={css('background:#fff;border:1px solid #F0E2E9;border-radius:18px;padding:18px 20px;box-shadow:0 14px 32px -28px rgba(107,20,54,.5);')}>
                <div style={css('display:flex;align-items:center;gap:12px;')}>
                  <div style={css(`width:44px;height:44px;flex:none;border-radius:13px;background:${TONES[rv.tone]};display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-weight:700;font-size:19px;color:rgba(42,26,32,.55);`)}>{rv.name[0]}</div>
                  <div style={css('flex:1;min-width:0;')}>
                    <div style={css('display:flex;align-items:center;gap:7px;')}>
                      <span style={css('font-weight:700;font-size:14.5px;')}>{rv.name}</span>
                      {rv.verified && (
                        <span style={css('display:inline-flex;align-items:center;gap:3px;background:#E9F6EF;color:#2FA36B;border-radius:7px;padding:2px 7px;font-size:10px;font-weight:800;')}>
                          <span style={css("font-family:'Material Symbols Outlined';font-size:12px;")}>verified</span>Verified
                        </span>
                      )}
                    </div>
                    <div style={css('color:#8A7078;font-size:12px;margin-top:2px;')}>{rv.date}</div>
                  </div>
                  <span style={css('color:#E0B84B;font-size:14px;letter-spacing:1px;')}>{starsFor(rv.rating)}</span>
                </div>
                <div style={css('color:#5C4650;font-size:14px;line-height:1.6;margin-top:12px;')}>{rv.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* YOU MAY ALSO LIKE */}
      <div style={css('max-width:1300px;margin:0 auto;padding:0 clamp(16px,4vw,44px) clamp(28px,4vw,56px);')}>
        <div style={css('display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:12px;')}>
          <div>
            <div className="agx-eyebrow" style={css('font-size:10.5px;color:#B02454;')}>Complete the look</div>
            <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(26px,3vw,38px);line-height:1.06;margin-top:6px;")}>You may also like</div>
          </div>
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/buyer/results'); }} className="agx-eyebrow" style={css('font-size:10px;color:#B02454;')}>Browse all →</a>
        </div>
        <div className="agx-scroll" style={css('display:flex;gap:18px;overflow-x:auto;padding-bottom:6px;margin-top:22px;')}>
          {related.map((p) => (
            <div key={p.id} onClick={() => navigate(`/buyer/product/${p.id}`)} className="agx-lift" style={css('flex:none;width:230px;cursor:pointer;')}>
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
      </div>
    </div>
  );
}
