import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { useShop } from '@/state/ShopContext';
import { COLORS, OCCASIONS, PRODUCTS, SORTS, fmt } from '@/data/demo';

const FILTER_CATS = ['Sarees', 'Lehengas', 'Gowns', 'Kurtis', 'Bridal'];

/** Bottom-sheet filter overlay, shown over the results screen on mobile. */
export function FilterSheet() {
  const navigate = useNavigate();
  const { filters, toggleFilter, setSort, setMaxPrice, resetFilters } = useShop();

  const results = PRODUCTS.filter(
    (p) =>
      p.price <= filters.maxPrice &&
      (filters.cats.length === 0 || filters.cats.includes(p.cat)) &&
      (filters.colors.length === 0 || filters.colors.includes(p.color)) &&
      (filters.occasions.length === 0 || filters.occasions.includes(p.occasion)),
  );

  const close = () => navigate('/buyer/results');
  const pricePlus = filters.maxPrice >= 10000 ? '+' : '';

  return (
    <div style={css('position:fixed;inset:0;z-index:120;')}>
      <div onClick={close} style={css('position:absolute;inset:0;background:rgba(42,10,24,.45);backdrop-filter:blur(4px);animation:agx-fade .2s ease;')} />
      <div className="agx-scroll" style={css('position:absolute;left:0;right:0;bottom:0;max-height:88%;overflow-y:auto;background:#fff;border-radius:28px 28px 0 0;padding:14px 22px 24px;animation:agx-sheet .28s cubic-bezier(.2,.9,.3,1);')}>
        <div style={css('width:44px;height:5px;border-radius:3px;background:#EAD3DE;margin:0 auto 14px;')} />
        <div style={css('display:flex;align-items:center;justify-content:space-between;')}>
          <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:26px;")}>Filters</div>
          <button onClick={resetFilters} style={css('border:none;background:none;color:#B02454;font-weight:700;font-size:14px;cursor:pointer;')}>Reset</button>
        </div>

        <div style={css('font-weight:800;font-size:14px;margin-top:18px;')}>Price range</div>
        <div style={css('display:flex;justify-content:space-between;font-size:13px;color:#8A7078;font-weight:700;margin-top:8px;')}>
          <span>₹0</span><span style={css('color:#B02454;')}>{fmt(filters.maxPrice)}{pricePlus}</span>
        </div>
        <input type="range" min={0} max={10000} step={100} value={filters.maxPrice} onChange={(e) => setMaxPrice(+e.target.value)} style={css('width:100%;accent-color:#D6336C;margin-top:6px;height:24px;')} />

        <div style={css('font-weight:800;font-size:14px;margin-top:12px;')}>Category</div>
        <div style={css('display:flex;flex-wrap:wrap;gap:9px;margin-top:10px;')}>
          {FILTER_CATS.map((c) => {
            const on = filters.cats.includes(c);
            return (
              <button key={c} onClick={() => toggleFilter('cats', c)} style={css(`border:1.5px solid ${on ? '#D6336C' : '#F0D8E2'};background:${on ? '#FCE0EC' : '#fff'};color:${on ? '#B02454' : '#6B5560'};border-radius:999px;padding:8px 15px;font-size:13px;font-weight:700;cursor:pointer;`)}>{c}</button>
            );
          })}
        </div>

        <div style={css('font-weight:800;font-size:14px;margin-top:18px;')}>Colour</div>
        <div style={css('display:flex;flex-wrap:wrap;gap:12px;margin-top:12px;')}>
          {COLORS.map((c) => (
            <button key={c.name} onClick={() => toggleFilter('colors', c.name)} style={css('display:flex;flex-direction:column;align-items:center;gap:5px;border:none;background:none;cursor:pointer;')}>
              <span style={css(`width:40px;height:40px;border-radius:50%;background:${c.hex};box-shadow:0 0 0 ${filters.colors.includes(c.name) ? '3px #D6336C' : '1px #EAD3DE'};`)} />
              <span style={css('font-size:11px;font-weight:700;color:#6B5560;')}>{c.name}</span>
            </button>
          ))}
        </div>

        <div style={css('font-weight:800;font-size:14px;margin-top:18px;')}>Occasion</div>
        <div style={css('display:flex;flex-wrap:wrap;gap:9px;margin-top:10px;')}>
          {OCCASIONS.map((o) => {
            const on = filters.occasions.includes(o);
            return (
              <button key={o} onClick={() => toggleFilter('occasions', o)} style={css(`border:1.5px solid ${on ? '#D6336C' : '#F0D8E2'};background:${on ? '#FCE0EC' : '#fff'};color:${on ? '#B02454' : '#6B5560'};border-radius:999px;padding:8px 15px;font-size:13px;font-weight:700;cursor:pointer;`)}>{o}</button>
            );
          })}
        </div>

        <div style={css('font-weight:800;font-size:14px;margin-top:18px;')}>Sort by</div>
        <div style={css('display:flex;flex-direction:column;gap:2px;margin-top:8px;')}>
          {SORTS.map((s) => {
            const on = filters.sort === s;
            return (
              <button key={s} onClick={() => setSort(s)} style={css(`display:flex;align-items:center;justify-content:space-between;border:none;background:none;padding:11px 4px;cursor:pointer;font-size:14px;font-weight:${on ? 800 : 600};color:${on ? '#2A1A20' : '#6B5560'};border-bottom:1px solid #F5E4EC;`)}>
                {s}<span style={css(`font-family:'Material Symbols Outlined';color:#D6336C;opacity:${on ? 1 : 0};`)}>check_circle</span>
              </button>
            );
          })}
        </div>

        <div style={css('display:flex;gap:12px;margin-top:22px;')}>
          <button onClick={resetFilters} style={css('flex:1;height:52px;border:1.5px solid #F0D8E2;background:#fff;border-radius:14px;font-weight:700;cursor:pointer;color:#B02454;')}>Reset</button>
          <button onClick={close} style={css('flex:2;height:52px;border:none;border-radius:14px;background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;font-weight:800;cursor:pointer;box-shadow:0 14px 30px -14px rgba(214,51,108,.8);')}>
            Show {results.length} results
          </button>
        </div>
      </div>
    </div>
  );
}
