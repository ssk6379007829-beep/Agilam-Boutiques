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

type SortKey = 'rating' | 'reviews' | 'products' | 'name';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'rating', label: 'Top rated' },
  { key: 'reviews', label: 'Most reviewed' },
  { key: 'products', label: 'Most styles' },
  { key: 'name', label: 'A – Z' },
];

export function Boutiques() {
  const navigate = useNavigate();
  const { showToast } = useShop();
  const { boutiques: BOUTIQUES } = useCatalog();

  const [query, setQuery] = useState('');
  const [following, setFollowing] = useState<Record<string, boolean>>({});

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<SortKey>('rating');
  const [city, setCity] = useState<string | null>(null);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const cities = useMemo(
    () => Array.from(new Set(BOUTIQUES.map((b) => b.city))).sort(),
    [BOUTIQUES],
  );

  const activeFilters =
    (city ? 1 : 0) + (verifiedOnly ? 1 : 0) + (sort !== 'rating' ? 1 : 0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = BOUTIQUES.filter((b) => {
      if (q && !b.name.toLowerCase().includes(q) && !b.city.toLowerCase().includes(q)) return false;
      if (city && b.city !== city) return false;
      if (verifiedOnly && !b.verified) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'reviews':
          return b.reviews - a.reviews;
        case 'products':
          return b.products - a.products;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'rating':
        default:
          return b.rating - a.rating;
      }
    });
    return list;
  }, [BOUTIQUES, query, city, verifiedOnly, sort]);

  function toggleFollow(e: MouseEvent, id: string, name: string) {
    e.stopPropagation();
    setFollowing((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      showToast(next[id] ? 'Following ' + name : 'Unfollowed ' + name);
      return next;
    });
  }

  function clearFilters() {
    setSort('rating');
    setCity(null);
    setVerifiedOnly(false);
  }

  return (
    <div style={css('min-height:100%;background:#FBF6F2;padding-bottom:20px;')}>
      {/* Screen header */}
      <div style={css('padding:2px 0 4px;')}>
        <div className="agx-eyebrow" style={css('font-size:10.5px;color:#B02454;')}>The directory</div>
        <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(26px,3.2vw,40px);line-height:1.1;margin-top:6px;letter-spacing:-.01em;")}>Boutiques</div>
      </div>

      {/* Search bar with a filter action on the right, per the design */}
      <div style={css('display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #EFDCE4;border-radius:16px;padding:0 8px 0 14px;height:52px;box-shadow:0 10px 26px -18px rgba(107,20,54,.5);margin-top:16px;')}>
        <span style={css("font-family:'Material Symbols Outlined';color:#B79AA6;font-size:21px;")}>search</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search boutiques by name…"
          style={css('border:none;background:none;flex:1;font-size:14px;font-weight:500;color:#241019;min-width:0;')}
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            style={css('width:38px;height:38px;flex:none;border-radius:12px;border:none;background:#FBF0F4;cursor:pointer;display:flex;align-items:center;justify-content:center;')}
          >
            <span style={css("font-family:'Material Symbols Outlined';color:#B02454;font-size:20px;")}>close</span>
          </button>
        )}
        <button
          onClick={() => setShowFilters((s) => !s)}
          style={css(`position:relative;width:38px;height:38px;flex:none;border-radius:12px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;background:${showFilters || activeFilters ? 'linear-gradient(140deg,#E14A7E,#B02454 70%,#8E1C44)' : '#FBF0F4'};box-shadow:${showFilters || activeFilters ? '0 8px 18px -8px rgba(176,36,84,.7)' : 'none'};`)}
        >
          <span style={css(`font-family:'Material Symbols Outlined';font-size:20px;color:${showFilters || activeFilters ? '#fff' : '#B02454'};`)}>tune</span>
          {!!activeFilters && (
            <span style={css('position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;padding:0 3px;border-radius:8px;background:#fff;color:#B02454;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;border:1.5px solid #B02454;')}>
              {activeFilters}
            </span>
          )}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div style={css('background:#fff;border:1px solid #F2E4EA;border-radius:20px;padding:16px;margin-top:12px;box-shadow:0 18px 40px -32px rgba(107,20,54,.55);')}>
          <div style={css('display:flex;align-items:center;justify-content:space-between;gap:10px;')}>
            <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:15px;color:#2A1A20;")}>Filters</div>
            {!!activeFilters && (
              <button onClick={clearFilters} style={css('border:none;background:none;cursor:pointer;color:#B02454;font-size:12.5px;font-weight:700;font-family:inherit;')}>
                Clear all
              </button>
            )}
          </div>

          {/* Sort */}
          <div style={css('font-size:10px;color:#B79AA6;letter-spacing:.12em;text-transform:uppercase;font-weight:700;margin:14px 0 8px;')}>Sort by</div>
          <div style={css('display:flex;flex-wrap:wrap;gap:8px;')}>
            {SORTS.map((s) => {
              const on = sort === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setSort(s.key)}
                  style={css(`border:1px solid ${on ? 'transparent' : '#EFDCE4'};background:${on ? 'linear-gradient(140deg,#E14A7E,#B02454 70%,#8E1C44)' : '#fff'};color:${on ? '#fff' : '#6B4A56'};cursor:pointer;padding:8px 14px;border-radius:999px;font-size:12.5px;font-weight:700;font-family:inherit;`)}
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          {/* City */}
          <div style={css('font-size:10px;color:#B79AA6;letter-spacing:.12em;text-transform:uppercase;font-weight:700;margin:16px 0 8px;')}>City</div>
          <div style={css('display:flex;flex-wrap:wrap;gap:8px;')}>
            <button
              onClick={() => setCity(null)}
              style={css(`border:1px solid ${!city ? 'transparent' : '#EFDCE4'};background:${!city ? 'linear-gradient(140deg,#E14A7E,#B02454 70%,#8E1C44)' : '#fff'};color:${!city ? '#fff' : '#6B4A56'};cursor:pointer;padding:8px 14px;border-radius:999px;font-size:12.5px;font-weight:700;font-family:inherit;`)}
            >
              All cities
            </button>
            {cities.map((c) => {
              const on = city === c;
              return (
                <button
                  key={c}
                  onClick={() => setCity(on ? null : c)}
                  style={css(`border:1px solid ${on ? 'transparent' : '#EFDCE4'};background:${on ? 'linear-gradient(140deg,#E14A7E,#B02454 70%,#8E1C44)' : '#fff'};color:${on ? '#fff' : '#6B4A56'};cursor:pointer;padding:8px 14px;border-radius:999px;font-size:12.5px;font-weight:700;font-family:inherit;`)}
                >
                  {c}
                </button>
              );
            })}
          </div>

          {/* Toggles */}
          <div style={css('display:flex;flex-wrap:wrap;gap:8px;margin-top:16px;')}>
            <button
              onClick={() => setVerifiedOnly((v) => !v)}
              style={css(`display:flex;align-items:center;gap:6px;border:1px solid ${verifiedOnly ? 'transparent' : '#EFDCE4'};background:${verifiedOnly ? 'linear-gradient(140deg,#E14A7E,#B02454 70%,#8E1C44)' : '#fff'};color:${verifiedOnly ? '#fff' : '#6B4A56'};cursor:pointer;padding:8px 14px;border-radius:999px;font-size:12.5px;font-weight:700;font-family:inherit;`)}
            >
              <span style={css('font-family:\'Material Symbols Outlined\';font-size:16px;')}>verified</span>
              Verified only
            </button>
          </div>
        </div>
      )}

      {/* Section label */}
      <div style={css('display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:20px 2px 6px;')}>
        <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:16px;color:#2A1A20;")}>
          {query || activeFilters ? 'Results' : 'All Boutiques'}
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
            <div style={css('color:#8A7078;font-size:14px;margin-top:10px;')}>No boutiques match your filters.</div>
            {(query || activeFilters) && (
              <button
                onClick={() => { setQuery(''); clearFilters(); }}
                style={css('margin-top:14px;border:1px solid #EFDCE4;background:#fff;cursor:pointer;padding:9px 18px;border-radius:999px;font-size:13px;font-weight:700;color:#B02454;font-family:inherit;')}
              >
                Reset
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
