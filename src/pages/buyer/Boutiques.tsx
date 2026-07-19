import { useMemo, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { ImageSlot } from '@/components/ui/ImageSlot';
import { useShop } from '@/state/ShopContext';
import { useCatalog } from '@/state/CatalogContext';
import { TONES } from '@/data/demo';

/** Compact review counts the way the design shows them: 2100 → "2.1k". */
function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

export function Boutiques() {
  const navigate = useNavigate();
  const { showToast } = useShop();
  const { boutiques: BOUTIQUES } = useCatalog();

  const [query, setQuery] = useState('');
  const [following, setFollowing] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return BOUTIQUES;
    return BOUTIQUES.filter(
      (b) => b.name.toLowerCase().includes(q) || b.city.toLowerCase().includes(q),
    );
  }, [BOUTIQUES, query]);

  function toggleFollow(e: MouseEvent, id: string, name: string) {
    e.stopPropagation();
    setFollowing((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      showToast(next[id] ? 'Following ' + name : 'Unfollowed ' + name);
      return next;
    });
  }

  return (
    <div style={css('min-height:100%;background:#FBF6F2;padding-bottom:20px;')}>
      {/* Screen header — title + share, mirroring the app design */}
      <div style={css('display:flex;align-items:center;justify-content:space-between;gap:12px;padding:2px 0 4px;')}>
        <div>
          <div className="agx-eyebrow" style={css('font-size:10.5px;color:#B02454;')}>The directory</div>
          <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(26px,3.2vw,40px);line-height:1.1;margin-top:6px;letter-spacing:-.01em;")}>Boutiques</div>
        </div>
        <button
          onClick={() => showToast('Share link copied')}
          style={css('width:44px;height:44px;flex:none;border-radius:14px;border:1px solid #EFDCE4;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 22px -18px rgba(107,20,54,.6);')}
        >
          <span style={css("font-family:'Material Symbols Outlined';color:#B02454;font-size:21px;")}>ios_share</span>
        </button>
      </div>

      {/* Search bar with the Agilam logo badge on the right, per the design */}
      <div style={css('display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #EFDCE4;border-radius:16px;padding:0 8px 0 14px;height:52px;box-shadow:0 10px 26px -18px rgba(107,20,54,.5);margin-top:16px;')}>
        <span style={css("font-family:'Material Symbols Outlined';color:#B79AA6;font-size:21px;")}>search</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search boutiques by name…"
          style={css('border:none;background:none;flex:1;font-size:14px;font-weight:500;color:#241019;min-width:0;')}
        />
        {query ? (
          <button
            onClick={() => setQuery('')}
            style={css('width:38px;height:38px;flex:none;border-radius:12px;border:none;background:#FBF0F4;cursor:pointer;display:flex;align-items:center;justify-content:center;')}
          >
            <span style={css("font-family:'Material Symbols Outlined';color:#B02454;font-size:20px;")}>close</span>
          </button>
        ) : (
          <span style={css('width:38px;height:38px;flex:none;border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#fff;border:1px solid #F2E4EA;')}>
            <img src="/agilam-logo.jpg" alt="Agilam" style={css('width:100%;height:100%;object-fit:cover;')} />
          </span>
        )}
      </div>

      {/* Section label */}
      <div style={css('display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:20px 2px 6px;')}>
        <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:16px;color:#2A1A20;")}>
          {query ? 'Results' : 'All Boutiques'}
        </div>
        <div style={css("font-family:'IBM Plex Mono',monospace;font-size:11px;color:#B79AA6;letter-spacing:.04em;")}>
          {filtered.length} {filtered.length === 1 ? 'boutique' : 'boutiques'}
        </div>
      </div>

      {/* Vertical list */}
      <div style={css('background:#fff;border:1px solid #F2E4EA;border-radius:22px;overflow:hidden;box-shadow:0 18px 40px -32px rgba(107,20,54,.55);')}>
        {filtered.map((b, i) => (
          <div
            key={b.id}
            onClick={() => navigate(`/buyer/boutique/${b.id}`)}
            className="agx-lift"
            style={css(`display:flex;align-items:center;gap:14px;padding:14px 16px;cursor:pointer;${i > 0 ? 'border-top:1px solid #F5E7ED;' : ''}`)}
          >
            <div className="agx-zoom" style={css(`position:relative;width:74px;height:74px;flex:none;border-radius:16px;overflow:hidden;background:${TONES[b.tone]};`)}>
              <ImageSlot src={b.image || undefined} placeholder={`${b.name} — cover`} style={css('position:absolute;inset:0;')} />
              {b.featured && (
                <div style={css('position:absolute;left:5px;top:5px;width:22px;height:22px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#D9B25A,#B0863B);box-shadow:0 6px 14px -6px rgba(176,134,59,.9);')}>
                  <span style={css("font-family:'Material Symbols Outlined';font-size:13px;color:#fff;")}>workspace_premium</span>
                </div>
              )}
            </div>

            <div style={css('flex:1;min-width:0;')}>
              <div style={css('display:flex;align-items:center;gap:6px;')}>
                <span style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:17px;line-height:1.15;color:#2A1A20;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;")}>{b.name}</span>
                {b.verified && <span style={css("font-family:'Material Symbols Outlined';font-size:16px;color:#3E9BE0;flex:none;")}>verified</span>}
              </div>
              <div style={css('display:flex;align-items:center;gap:5px;margin-top:5px;')}>
                <span style={css("font-family:'Material Symbols Outlined';font-size:16px;color:#E0B84B;")}>star</span>
                <span style={css('font-size:13px;font-weight:700;color:#2A1A20;')}>{b.rating}</span>
                <span style={css('font-size:12.5px;color:#B79AA6;font-weight:600;')}>({formatCount(b.reviews)})</span>
              </div>
              <div style={css('display:flex;align-items:center;gap:4px;margin-top:5px;color:#8A7078;font-size:12.5px;')}>
                <span style={css("font-family:'Material Symbols Outlined';font-size:15px;")}>location_on</span>
                <span style={css('white-space:nowrap;overflow:hidden;text-overflow:ellipsis;')}>{b.area && b.area !== b.city ? `${b.area}, ${b.city}` : b.city}</span>
              </div>
            </div>

            <button
              onClick={(e: MouseEvent) => toggleFollow(e, b.id, b.name)}
              style={css('width:42px;height:42px;flex:none;border-radius:13px;border:none;background:none;cursor:pointer;display:flex;align-items:center;justify-content:center;')}
            >
              <span style={css(`font-family:'Material Symbols Outlined';font-size:24px;color:#D6336C;${following[b.id] ? 'font-variation-settings:"FILL" 1;' : ''}`)}>
                {following[b.id] ? 'favorite' : 'favorite_border'}
              </span>
            </button>
          </div>
        ))}

        {filtered.length === 0 && (
          <div style={css('padding:40px 20px;text-align:center;')}>
            <span style={css("font-family:'Material Symbols Outlined';font-size:40px;color:rgba(107,20,54,.2);")}>storefront</span>
            <div style={css('color:#8A7078;font-size:14px;margin-top:10px;')}>No boutiques match “{query}”.</div>
          </div>
        )}
      </div>
    </div>
  );
}
