import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { css } from '@/lib/css';
import { ImageSlot } from '@/components/ui/ImageSlot';
import { useShop } from '@/state/ShopContext';
import { useCatalog } from '@/state/CatalogContext';
import { TONES, fmt } from '@/data/demo';

/**
 * Buyer-facing boutique profile.
 *
 * Restyled to the mobile-card layout from the design mock: full-bleed cover,
 * an overlapping monogram avatar, a centred identity block (name · location ·
 * rating), a follow action and the boutique's collection grid. It reads live
 * data from `useCatalog()` (approved boutiques + their products are public, so
 * this works for anonymous buyers) and wires every control to a real flow:
 * back, cart, follow (persisted client-side — anonymous buyers have no id to
 * key a DB row on), chat and product navigation.
 */

const FOLLOW_KEY = 'agx:following';

function readFollows(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(FOLLOW_KEY) || '{}') as Record<string, boolean>;
  } catch {
    return {};
  }
}

function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((w) => w[0]).join('');
  return (initials || name.slice(0, 2)).toUpperCase();
}

export function BoutiqueProfile() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showToast, cartCount } = useShop();
  const { products: PRODUCTS, boutiques: BOUTIQUES, loading } = useCatalog();
  const [bqFilter, setBqFilter] = useState('All');
  const [following, setFollowing] = useState<boolean>(() => (id ? !!readFollows()[id] : false));

  const ab = BOUTIQUES.find((b) => b.id === id);

  const toggleFollow = useCallback(() => {
    if (!ab) return;
    setFollowing((prev) => {
      const next = !prev;
      const map = readFollows();
      if (next) map[ab.id] = true;
      else delete map[ab.id];
      try {
        localStorage.setItem(FOLLOW_KEY, JSON.stringify(map));
      } catch {
        /* storage may be unavailable (private mode) — the in-memory toggle still holds */
      }
      showToast(next ? `Following ${ab.name}` : `Unfollowed ${ab.name}`);
      return next;
    });
  }, [ab, showToast]);

  const bqCats = useMemo(
    () => (ab ? ['All', ...Array.from(new Set(PRODUCTS.filter((p) => p.boutique === ab.name).map((p) => p.cat)))] : ['All']),
    [PRODUCTS, ab],
  );
  const boutiqueProducts = useMemo(
    () => (ab ? PRODUCTS.filter((p) => p.boutique === ab.name && (bqFilter === 'All' || p.cat === bqFilter)) : []),
    [PRODUCTS, ab, bqFilter],
  );

  if (!ab) {
    return (
      <div style={css('min-height:60vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#8A7078;')}>
        {loading ? (
          <>
            <span className="agx-shimmer" style={css('width:56px;height:56px;border-radius:50%;')} />
            <span style={css('font-size:14px;')}>Loading boutique…</span>
          </>
        ) : (
          <>
            <span style={css("font-family:'Material Symbols Outlined';font-size:44px;color:#E0C4D0;")}>storefront</span>
            <span style={css('font-size:15px;')}>Boutique not found.</span>
            <button onClick={() => navigate('/buyer/boutiques')} style={css('margin-top:4px;background:#B02454;color:#fff;border:none;border-radius:12px;padding:10px 20px;font-weight:700;cursor:pointer;')}>
              Browse boutiques
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={css('width:100vw;margin-left:calc(50% - 50vw);min-height:100%;background:#FBF6F2;padding-bottom:40px;')}>
      {/* ---------- Cover ---------- */}
      <div className="agx-zoom" style={css(`position:relative;height:clamp(210px,36vw,360px);background:${TONES[ab.tone]};overflow:hidden;`)}>
        <ImageSlot src={ab.image} placeholder={`${ab.name} — cover`} style={css('position:absolute;inset:0;')} />
        <div style={css('position:absolute;inset:0;background:linear-gradient(180deg,rgba(30,8,18,.3) 0%,rgba(30,8,18,0) 30%,rgba(30,8,18,0) 62%,rgba(251,246,242,.55) 100%);pointer-events:none;')} />

        <button
          onClick={() => navigate('/buyer/boutiques')}
          aria-label="Back to boutiques"
          style={css('position:absolute;left:clamp(14px,3vw,28px);top:16px;width:42px;height:42px;border-radius:14px;border:none;background:rgba(255,255,255,.92);cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 26px -12px rgba(0,0,0,.5);')}
        >
          <span style={css("font-family:'Material Symbols Outlined';color:#B02454;")}>arrow_back</span>
        </button>

        <button
          onClick={() => navigate('/buyer/cart')}
          aria-label="View cart"
          style={css('position:absolute;right:clamp(14px,3vw,28px);top:16px;width:42px;height:42px;border-radius:14px;border:none;background:rgba(255,255,255,.92);cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 26px -12px rgba(0,0,0,.5);')}
        >
          <span style={css("font-family:'Material Symbols Outlined';color:#B02454;")}>shopping_bag</span>
          {cartCount > 0 && (
            <span style={css('position:absolute;top:-5px;right:-5px;min-width:18px;height:18px;padding:0 4px;border-radius:9px;background:#D6336C;color:#fff;font-size:10.5px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px -3px rgba(214,51,108,.9);')}>
              {cartCount}
            </span>
          )}
        </button>

        {ab.featured && (
          <div style={css('position:absolute;left:clamp(14px,3vw,28px);bottom:14px;display:flex;align-items:center;gap:6px;background:linear-gradient(135deg,#D9B25A,#B0863B);color:#fff;padding:6px 13px;border-radius:999px;box-shadow:0 12px 30px -12px rgba(176,134,59,.9);')}>
            <span style={css("font-family:'Material Symbols Outlined';font-size:15px;")}>workspace_premium</span>
            <span className="agx-eyebrow" style={css('font-size:9px;letter-spacing:.14em;')}>Featured Boutique</span>
          </div>
        )}
      </div>

      {/* ---------- Identity card ---------- */}
      <div style={css('max-width:900px;margin:0 auto;padding:0 clamp(14px,4vw,28px);')}>
        <div
          className="agx-reveal"
          style={css('position:relative;margin-top:-30px;background:#fff;border:1px solid #F2E4EA;border-radius:26px;padding:56px clamp(18px,4vw,34px) 26px;box-shadow:0 26px 60px -40px rgba(107,20,54,.55);')}
        >
          {/* Monogram avatar overlapping the card's top edge */}
          <div
            style={css('position:absolute;top:-42px;left:50%;transform:translateX(-50%);width:84px;height:84px;border-radius:50%;background:linear-gradient(135deg,#D6336C,#8E1E43);border:4px solid #fff;box-shadow:0 16px 34px -16px rgba(214,51,108,.9);display:flex;align-items:center;justify-content:center;')}
          >
            <span style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:30px;color:#fff;letter-spacing:.02em;")}>{monogram(ab.name)}</span>
          </div>

          {/* Name + verified */}
          <div style={css('display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;text-align:center;')}>
            <span style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(24px,3.4vw,34px);line-height:1.1;letter-spacing:-.01em;")}>{ab.name}</span>
            {ab.verified && (
              <span title="Verified boutique" style={css("font-family:'Material Symbols Outlined';font-size:22px;color:#3A9BE0;")}>verified</span>
            )}
          </div>

          {/* Location */}
          <div style={css('display:flex;align-items:center;justify-content:center;gap:5px;margin-top:8px;color:#8A7078;font-size:14px;')}>
            <span style={css("font-family:'Material Symbols Outlined';font-size:17px;color:#B02454;")}>location_on</span>
            {ab.city}, Tamil Nadu
          </div>

          {/* Rating */}
          <div style={css('display:flex;align-items:center;justify-content:center;gap:6px;margin-top:8px;font-size:15px;font-weight:700;')}>
            <span style={css("font-family:'Material Symbols Outlined';font-size:19px;color:#E0B84B;")}>star</span>
            {ab.rating}
            <span style={css('color:#8A7078;font-weight:600;')}>({ab.reviews})</span>
          </div>

          {/* Description + Follow / Chat */}
          <div style={css('display:flex;align-items:center;gap:16px;flex-wrap:wrap;justify-content:space-between;margin-top:22px;padding-top:22px;border-top:1px solid #F4E6EC;')}>
            <p style={css("flex:1;min-width:200px;color:#5C4650;font-size:clamp(14px,1.3vw,16px);line-height:1.6;margin:0;font-family:'Playfair Display',serif;font-style:italic;")}>
              {ab.desc}
            </p>
            <div style={css('display:flex;gap:10px;flex:none;')}>
              <button
                onClick={() => navigate(`/buyer/chat/${ab.id}`)}
                aria-label={`Chat with ${ab.name}`}
                style={css('display:flex;align-items:center;gap:7px;background:#fff;color:#B02454;border:1.5px solid #F0D0DE;border-radius:14px;padding:11px 16px;font-weight:800;font-size:14px;cursor:pointer;')}
              >
                <span style={css("font-family:'Material Symbols Outlined';font-size:19px;")}>chat</span>
                Chat
              </button>
              <button
                onClick={toggleFollow}
                aria-pressed={following}
                style={css(
                  following
                    ? 'display:flex;align-items:center;gap:7px;background:#fff;color:#B02454;border:1.5px solid #B02454;border-radius:14px;padding:11px 20px;font-weight:800;font-size:14px;cursor:pointer;'
                    : 'display:flex;align-items:center;gap:7px;background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;border:none;border-radius:14px;padding:11px 22px;font-weight:800;font-size:14px;cursor:pointer;box-shadow:0 14px 30px -14px rgba(214,51,108,.9);',
                )}
              >
                <span style={css("font-family:'Material Symbols Outlined';font-size:19px;")}>{following ? 'check' : 'favorite'}</span>
                {following ? 'Following' : 'Follow'}
              </button>
            </div>
          </div>

          {/* Contact shortcuts */}
          <div style={css('display:flex;flex-wrap:wrap;gap:10px;margin-top:18px;')}>
            <button
              onClick={() => showToast('Opening Instagram → @' + ab.insta)}
              style={css('flex:1;min-width:200px;display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid #F0D8E2;border-radius:16px;background:#FCFAFB;cursor:pointer;text-align:left;')}
            >
              <span style={css('width:40px;height:40px;border-radius:12px;flex:none;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#F58529,#DD2A7B 55%,#8134AF);')}>
                <span style={css("font-family:'Material Symbols Outlined';color:#fff;font-size:22px;")}>photo_camera</span>
              </span>
              <span style={css('flex:1;min-width:0;')}>
                <span style={css('display:block;font-weight:800;font-size:13.5px;color:#241019;')}>@{ab.insta}</span>
                <span style={css('display:block;font-size:12px;color:#8A7078;margin-top:1px;')}>View on Instagram</span>
              </span>
              <span style={css("font-family:'Material Symbols Outlined';color:#C9A9B6;font-size:19px;")}>open_in_new</span>
            </button>
            <button
              onClick={() => showToast('Opening map → ' + ab.area)}
              style={css('flex:1;min-width:200px;display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid #F0D8E2;border-radius:16px;background:#FCFAFB;cursor:pointer;text-align:left;')}
            >
              <span style={css('width:40px;height:40px;border-radius:12px;flex:none;display:flex;align-items:center;justify-content:center;background:#FCE0EC;')}>
                <span style={css("font-family:'Material Symbols Outlined';color:#B02454;font-size:22px;")}>location_on</span>
              </span>
              <span style={css('flex:1;min-width:0;')}>
                <span style={css('display:block;font-weight:800;font-size:13.5px;color:#241019;')}>{ab.area}</span>
                <span style={css('display:block;font-size:12px;color:#8A7078;margin-top:1px;')}>Get directions</span>
              </span>
              <span style={css("font-family:'Material Symbols Outlined';color:#C9A9B6;font-size:19px;")}>near_me</span>
            </button>
          </div>
        </div>

        {/* ---------- Collections ---------- */}
        <div style={css('display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:32px;')}>
          <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(21px,2.6vw,28px);line-height:1.1;")}>
            Collections
            <span style={css("font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:500;color:#8A7078;letter-spacing:0;margin-left:8px;")}>· {ab.products} styles</span>
          </div>
          {bqFilter !== 'All' && (
            <button onClick={() => setBqFilter('All')} style={css('border:none;background:none;color:#B02454;font-weight:800;font-size:13.5px;cursor:pointer;white-space:nowrap;')}>
              View All
            </button>
          )}
        </div>

        {/* Category chips */}
        {bqCats.length > 2 && (
          <div className="agx-scroll" style={css('display:flex;gap:9px;overflow-x:auto;padding:16px 0 4px;')}>
            {bqCats.map((c) => {
              const on = bqFilter === c;
              return (
                <button
                  key={c}
                  onClick={() => setBqFilter(c)}
                  style={css(`flex:none;border:1.5px solid ${on ? '#B02454' : '#F0D8E2'};background:${on ? '#B02454' : '#fff'};color:${on ? '#fff' : '#6B5560'};border-radius:999px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;`)}
                >
                  {c}
                </button>
              );
            })}
          </div>
        )}

        {/* Product grid */}
        {boutiqueProducts.length > 0 ? (
          <div className="agx-rgrid" style={css('margin-top:18px;')}>
            {boutiqueProducts.map((p) => (
              <div key={p.id} onClick={() => navigate(`/buyer/product/${p.id}`)} className="agx-lift agx-reveal" style={css('cursor:pointer;')}>
                <div className="agx-zoom" style={css(`position:relative;aspect-ratio:3/4;border-radius:20px;overflow:hidden;background:${TONES[p.tone]};box-shadow:0 16px 34px -24px rgba(107,20,54,.6);`)}>
                  <ImageSlot src={p.image} placeholder={p.title} style={css('position:absolute;inset:0;')} />
                  <div style={css('position:absolute;left:10px;bottom:10px;display:flex;align-items:center;gap:4px;background:rgba(255,255,255,.96);border-radius:9px;padding:3px 8px;font-size:11px;font-weight:800;color:#241019;box-shadow:0 4px 10px rgba(0,0,0,.14);')}>
                    <span style={css("font-family:'Material Symbols Outlined';font-size:13px;color:#E0B84B;")}>star</span>
                    {p.rating}
                  </div>
                  {p.stock === 0 && (
                    <div style={css('position:absolute;inset:0;background:rgba(255,255,255,.55);display:flex;align-items:center;justify-content:center;')}>
                      <span style={css('background:#241019;color:#fff;font-size:11px;font-weight:800;padding:5px 12px;border-radius:999px;')}>Sold out</span>
                    </div>
                  )}
                </div>
                <div style={css('padding:11px 2px 0;text-align:center;')}>
                  <div style={css('font-size:13.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;')}>{p.title}</div>
                  <div style={css("display:inline-block;margin-top:8px;font-family:'Playfair Display',serif;font-weight:700;color:#B02454;font-size:16px;border:1px solid #F0D8E2;border-radius:12px;padding:6px 16px;background:#fff;")}>
                    {fmt(p.price)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={css('display:flex;flex-direction:column;align-items:center;text-align:center;padding:54px 24px;')}>
            <span style={css("font-family:'Material Symbols Outlined';font-size:40px;color:#E0C4D0;")}>checkroom</span>
            <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:20px;margin-top:12px;")}>Nothing here yet</div>
            <div style={css('color:#8A7078;font-size:13.5px;margin-top:5px;')}>
              {bqFilter === 'All' ? 'This boutique hasn’t listed any styles yet.' : `No ${bqFilter.toLowerCase()} in this collection.`}
            </div>
            {bqFilter !== 'All' && (
              <button onClick={() => setBqFilter('All')} style={css('margin-top:14px;background:#B02454;color:#fff;border:none;border-radius:12px;padding:10px 20px;font-weight:700;cursor:pointer;')}>
                View all styles
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
