import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { TONES, fmt, statusStyle } from '@/data/demo';
import { useMyBoutique } from '@/hooks/useMyBoutique';
import { useAsync } from '@/hooks/useAsync';
import { fetchOrdersForBoutique } from '@/data/orders';
import { fetchProductsByBoutique } from '@/data/products';
import { toOrderView } from '@/lib/orderView';

export function Dashboard() {
  const navigate = useNavigate();
  const { boutique } = useMyBoutique();
  const { data: orderRows } = useAsync(() => (boutique ? fetchOrdersForBoutique(boutique.id) : Promise.resolve([])), [boutique?.id]);
  const { data: productRows } = useAsync(() => (boutique ? fetchProductsByBoutique(boutique.id) : Promise.resolve([])), [boutique?.id]);

  const orders = (orderRows ?? []).map((o, i) => toOrderView(o, i));
  const customerCount = new Set((orderRows ?? []).map((o) => o.buyer_id)).size;
  const recentOrders = orders.slice(0, 6);

  const SELLER_STATS = [
    { label: 'Total Products', value: String((productRows ?? []).length), icon: 'inventory_2', tint: '#FCE0EC', ic: '#D6336C' },
    { label: 'Total Orders', value: String(orders.length), icon: 'receipt_long', tint: '#E6F0FA', ic: '#3A6EA5' },
    { label: 'Total Revenue', value: fmt(orders.reduce((s, o) => s + o.amount, 0)), icon: 'payments', tint: '#F3EAF5', ic: '#9B7FC7' },
    { label: 'Total Customers', value: String(customerCount), icon: 'group', tint: '#E5F3EC', ic: '#2FA36B' },
  ];

  const initial = (boutique?.name ?? 'B').charAt(0).toUpperCase();

  return (
    <div style={css('min-height:100%;background:#FBF6F2;padding-bottom:20px;')}>
      <div style={css('width:100vw;margin-left:calc(50% - 50vw);background:linear-gradient(135deg,#8E1C44 0%,#B02454 52%,#D6336C 100%);color:#fff;position:relative;overflow:hidden;')}>
        <div style={css('position:absolute;top:-80px;right:-40px;width:320px;height:320px;border-radius:50%;background:radial-gradient(circle,rgba(244,217,166,.22),transparent 70%);pointer-events:none;')} />
        <div style={css('max-width:1240px;margin:0 auto;padding:clamp(24px,3.5vw,44px) clamp(20px,4vw,48px);position:relative;')}>
          <div style={css('display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;')}>
            <div style={css('display:flex;align-items:center;gap:14px;')}>
              <div style={css("width:56px;height:56px;border-radius:17px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-weight:700;font-size:27px;")}>{initial}</div>
              <div>
                <div className="agx-eyebrow" style={css('font-size:9.5px;color:#F4D9A6;')}>Seller studio</div>
                <div style={css('display:flex;align-items:center;gap:6px;margin-top:4px;')}>
                  <span style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(26px,3vw,38px);line-height:1;")}>{boutique?.name ?? 'Your Boutique'}</span>
                  {boutique?.verified && <span style={css("font-family:'Material Symbols Outlined';font-size:20px;color:#7FC0F2;")}>verified</span>}
                </div>
              </div>
            </div>
            <div style={css('display:flex;align-items:center;gap:10px;')}>
              <button onClick={() => navigate('/seller/notifications')} style={css('position:relative;width:46px;height:46px;border-radius:14px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.14);cursor:pointer;display:flex;align-items:center;justify-content:center;')}>
                <span style={css("font-family:'Material Symbols Outlined';color:#fff;")}>notifications</span>
                <span style={css('position:absolute;top:9px;right:10px;width:8px;height:8px;border-radius:50%;background:#FFD84D;')} />
              </button>
              <button onClick={() => navigate('/seller/add-product')} style={css('background:#fff;color:#B02454;border:none;border-radius:14px;padding:13px 20px;font-weight:800;font-size:14px;cursor:pointer;display:flex;align-items:center;gap:7px;box-shadow:0 14px 30px -14px rgba(0,0,0,.4);')}>
                <span style={css("font-family:'Material Symbols Outlined';font-size:20px;")}>add</span>Add product
              </button>
            </div>
          </div>
          <div style={css("font-family:'Playfair Display',serif;font-style:italic;font-size:clamp(16px,1.6vw,20px);opacity:.9;margin-top:20px;max-width:520px;")}>
            Welcome back — three new orders are waiting on you this morning.
          </div>
        </div>
      </div>

      <div className="agx-rgrid" style={css('margin-top:-30px;position:relative;')}>
        {SELLER_STATS.map((st) => (
          <div key={st.label} className="agx-lift" style={css('background:#fff;border:1px solid #F2E4EA;border-radius:20px;padding:18px;box-shadow:0 18px 40px -28px rgba(107,20,54,.55);')}>
            <div style={css(`width:42px;height:42px;border-radius:13px;background:${st.tint};display:flex;align-items:center;justify-content:center;`)}>
              <span style={css(`font-family:'Material Symbols Outlined';font-size:22px;color:${st.ic};`)}>{st.icon}</span>
            </div>
            <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:34px;line-height:1;margin-top:14px;")}>{st.value}</div>
            <div style={css('color:#8A7078;font-size:13px;font-weight:600;margin-top:4px;')}>{st.label}</div>
          </div>
        ))}
      </div>

      <div style={css('display:flex;align-items:flex-end;justify-content:space-between;margin:34px 0 16px;')}>
        <div>
          <div className="agx-eyebrow" style={css('font-size:10.5px;color:#B02454;')}>Needs your attention</div>
          <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(22px,2.4vw,30px);line-height:1.12;padding-bottom:2px;margin-top:6px;")}>Recent orders</div>
        </div>
        <a href="#" onClick={(e) => { e.preventDefault(); navigate('/seller/orders'); }} className="agx-eyebrow" style={css('font-size:10px;color:#B02454;')}>View all →</a>
      </div>

      <div className="agx-ord-grid" style={css('display:grid;grid-template-columns:1fr;gap:12px;')}>
        {recentOrders.length === 0 && (
          <div style={css('color:#8A7078;font-size:14px;padding:8px 2px;')}>No orders yet.</div>
        )}
        {recentOrders.map((o) => {
          const st = statusStyle(o.status);
          return (
            <div key={o.id} onClick={() => navigate(`/seller/orders/${encodeURIComponent(o.id)}`)} className="agx-lift" style={css('background:#fff;border:1px solid #F2E4EA;border-radius:18px;padding:14px;display:flex;gap:13px;align-items:center;cursor:pointer;box-shadow:0 14px 32px -26px rgba(107,20,54,.55);')}>
              <div style={css(`width:50px;height:50px;flex:none;border-radius:14px;background:${TONES[o.tone]};display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-weight:700;font-size:20px;color:rgba(42,26,32,.5);`)}>{o.customer[0]}</div>
              <div style={css('flex:1;min-width:0;')}>
                <div style={css('font-weight:700;font-size:14.5px;')}>{o.customer}</div>
                <div style={css('font-size:12.5px;color:#8A7078;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;')}>{o.item}</div>
              </div>
              <div style={css('text-align:right;')}>
                <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:16px;color:#B02454;")}>{fmt(o.amount)}</div>
                <span style={css(`display:inline-block;margin-top:4px;font-size:10.5px;font-weight:800;padding:3px 9px;border-radius:8px;background:${st.bg};color:${st.fg};`)}>{o.status}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
