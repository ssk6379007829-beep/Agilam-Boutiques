import { useNavigate, useParams } from 'react-router-dom';
import { css } from '@/lib/css';
import { TONES, fmt } from '@/data/demo';
import { ImageSlot } from '@/components/ui/ImageSlot';
import { useMyBoutique } from '@/hooks/useMyBoutique';
import { useAsync } from '@/hooks/useAsync';
import { fetchProduct } from '@/data/products';
import { fetchOrdersForBoutique } from '@/data/orders';

/**
 * Per-product analytics — the buyer-side story of one piece: how many people saw
 * it, liked it, shared it, saved it, and what it has actually sold. Views/shares
 * come from the engagement counters in migration 0031; orders and revenue are
 * aggregated live from the boutique's order line items.
 */

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return 'Never';
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export function ProductAnalytics() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { boutique } = useMyBoutique();

  const { data: product, loading } = useAsync(() => (id ? fetchProduct(id) : Promise.resolve(null)), [id]);
  const { data: orderRows } = useAsync(
    () => (boutique ? fetchOrdersForBoutique(boutique.id) : Promise.resolve([])),
    [boutique?.id],
  );

  if (!loading && !product) {
    return (
      <div style={css('min-height:60vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#8A7078;')}>
        <span style={css("font-family:'Material Symbols Outlined';font-size:40px;color:#E0C2CE;")}>search_off</span>
        <div style={css('font-size:15px;')}>Product not found.</div>
        <button onClick={() => navigate('/seller/products')} style={css('height:44px;padding:0 18px;border:none;border-radius:12px;background:#B02454;color:#fff;font-weight:800;cursor:pointer;')}>
          Back to products
        </button>
      </div>
    );
  }

  // Orders and revenue this piece actually earned — a rejected/cancelled order
  // sold nothing, so it does not count toward either.
  const orders = orderRows ?? [];
  let units = 0;
  let revenue = 0;
  let orderCount = 0;
  orders.forEach((o) => {
    if (o.status === 'rejected' || o.status === 'cancelled') return;
    const lines = (o.items ?? []).filter((it) => it.product_id === id || it.title === product?.title);
    if (!lines.length) return;
    orderCount += 1;
    lines.forEach((it) => {
      units += it.qty;
      revenue += Number(it.price) * it.qty;
    });
  });

  const p = product;
  const tiles = [
    { icon: 'visibility', label: 'Views', value: String(p?.views_count ?? 0), tint: '#E6F0FA', ic: '#3A6EA5' },
    { icon: 'favorite', label: 'Likes', value: String(p?.likes_count ?? 0), tint: '#FCE0EC', ic: '#D6336C' },
    { icon: 'ios_share', label: 'Shares', value: String(p?.shares_count ?? 0), tint: '#F3EAF5', ic: '#9B7FC7' },
    { icon: 'bookmark', label: 'Wishlist saves', value: String(p?.wishlist_count ?? 0), tint: '#FBF0DA', ic: '#C99A3F' },
    { icon: 'shopping_bag', label: 'Orders', value: String(orderCount), tint: '#E5F3EC', ic: '#2FA36B' },
    { icon: 'payments', label: 'Revenue generated', value: fmt(revenue), tint: '#F3EAD9', ic: '#B8860B' },
  ];

  const stock = p?.stock ?? 0;
  const stockTag =
    stock === 0
      ? { label: 'Out of stock', bg: '#FBE3E3', fg: '#D6455A' }
      : stock <= 5
        ? { label: `Low · ${stock} left`, bg: '#FBF0DA', fg: '#C99A3F' }
        : { label: `${stock} in stock`, bg: '#E5F3EC', fg: '#2FA36B' };

  return (
    <div style={css('min-height:100%;background:#FBF6F2;padding-bottom:20px;')}>
      <div style={css('padding:6px 20px 12px;display:flex;align-items:center;gap:10px;')}>
        <button onClick={() => navigate('/seller/products')} aria-label="Back" style={css('width:42px;height:42px;border-radius:12px;border:none;background:#fff;box-shadow:0 6px 18px -12px rgba(107,20,54,.6);cursor:pointer;display:flex;align-items:center;justify-content:center;')}>
          <span style={css("font-family:'Material Symbols Outlined';color:#B02454;")}>arrow_back</span>
        </button>
        <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:24px;")}>Product analytics</div>
      </div>

      {loading && <div style={css('color:#8A7078;font-size:14px;padding:8px 22px;')}>Loading…</div>}

      {p && (
        <div style={css('padding:0 20px;')}>
          {/* Identity */}
          <div style={css('background:#fff;border:1px solid #F2E4EA;border-radius:20px;padding:14px;display:flex;gap:13px;align-items:center;box-shadow:0 14px 32px -28px rgba(107,20,54,.55);')}>
            <div style={css(`width:64px;height:64px;flex:none;border-radius:16px;background:${TONES[p.tone]};position:relative;overflow:hidden;`)}>
              <ImageSlot src={p.image_url ?? undefined} placeholder={p.title} style={css('position:absolute;inset:0;')} />
            </div>
            <div style={css('flex:1;min-width:0;')}>
              <div style={css('font-weight:800;font-size:15px;color:#2A1A20;')}>{p.title}</div>
              <div style={css('font-size:12.5px;color:#8A7078;margin-top:1px;')}>{p.category} · {fmt(Number(p.price))}</div>
              <span style={css(`display:inline-block;margin-top:6px;font-size:10.5px;font-weight:800;padding:3px 9px;border-radius:8px;background:${stockTag.bg};color:${stockTag.fg};`)}>{stockTag.label}</span>
            </div>
            <button onClick={() => navigate('/seller/products')} aria-label="Edit" style={css('width:38px;height:38px;flex:none;border-radius:11px;border:1.5px solid #F0D8E2;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;')}>
              <span style={css("font-family:'Material Symbols Outlined';font-size:19px;color:#B02454;")}>edit</span>
            </button>
          </div>

          {/* Metrics grid */}
          <div className="agx-sd-stats" style={css('margin-top:14px;')}>
            {tiles.map((t) => (
              <div key={t.label} style={css('background:#fff;border:1px solid #F2E4EA;border-radius:18px;padding:15px;box-shadow:0 14px 32px -28px rgba(107,20,54,.55);')}>
                <span style={css(`width:38px;height:38px;border-radius:12px;background:${t.tint};display:flex;align-items:center;justify-content:center;`)}>
                  <span style={css(`font-family:'Material Symbols Outlined';font-size:20px;color:${t.ic};`)}>{t.icon}</span>
                </span>
                <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:24px;margin-top:11px;color:#2A1A20;word-break:break-word;")}>{t.value}</div>
                <div style={css('color:#8A7078;font-size:12px;font-weight:700;margin-top:3px;')}>{t.label}</div>
              </div>
            ))}
          </div>

          {/* Footnotes */}
          <div style={css('margin-top:14px;background:#fff;border:1px solid #F2E4EA;border-radius:18px;padding:14px 16px;box-shadow:0 14px 32px -28px rgba(107,20,54,.55);display:flex;flex-direction:column;gap:10px;')}>
            <div style={css('display:flex;align-items:center;gap:9px;font-size:13px;color:#5C4650;')}>
              <span style={css("font-family:'Material Symbols Outlined';font-size:19px;color:#3A6EA5;")}>schedule</span>
              <span style={css('flex:1;')}>Last viewed</span>
              <span style={css('font-weight:800;color:#2A1A20;')}>{fmtDate(p.last_viewed_at)}</span>
            </div>
            <div style={css('display:flex;align-items:center;gap:9px;font-size:13px;color:#5C4650;border-top:1px solid #F5E4EC;padding-top:10px;')}>
              <span style={css("font-family:'Material Symbols Outlined';font-size:19px;color:#2FA36B;")}>sell</span>
              <span style={css('flex:1;')}>Units sold</span>
              <span style={css('font-weight:800;color:#2A1A20;')}>{units}</span>
            </div>
            <div style={css('display:flex;align-items:center;gap:9px;font-size:13px;color:#5C4650;border-top:1px solid #F5E4EC;padding-top:10px;')}>
              <span style={css("font-family:'Material Symbols Outlined';font-size:19px;color:#9B7FC7;")}>event</span>
              <span style={css('flex:1;')}>Listed on</span>
              <span style={css('font-weight:800;color:#2A1A20;')}>{new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
