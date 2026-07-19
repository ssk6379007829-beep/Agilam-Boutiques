import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { ImageSlot } from '@/components/ui/ImageSlot';
import { useCatalog } from '@/state/CatalogContext';
import { TONES, TRACK_STAGES, fmt } from '@/data/demo';
import { readOrders, fromBuyerOrder, mergeServerOrders, formatOrderDate, STATUS_STAGE, type PlacedOrder, type BuyerDbOrder } from '@/lib/orderHistory';
import { fetchOrdersForBuyer } from '@/data/orders';
import { supabase } from '@/lib/supabase';

export function MyOrders() {
  const navigate = useNavigate();
  const { productById } = useCatalog();

  const [orders, setOrders] = useState<PlacedOrder[]>(() => readOrders());

  // A signed-in buyer's real orders come back via RLS — merge them with local.
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) return;
      try {
        const db = await fetchOrdersForBuyer(uid);
        mergeServerOrders(db.map((o) => fromBuyerOrder(o as unknown as BuyerDbOrder)));
        if (active) setOrders(readOrders());
      } catch {
        /* offline / RLS — keep the local list */
      }
    })();
    return () => { active = false; };
  }, []);

  // Open a live chat with the order's boutique, tagged with the order as an
  // enquiry card. Mirrors the button on the order tracking screen.
  const chatWithBoutique = (o: PlacedOrder) => {
    const item = o.items[0];
    navigate(`/buyer/chat/${o.boutiqueId}`, {
      state: {
        order: {
          orderId: o.id,
          title: item?.title ?? 'Order',
          image: item ? productById(item.pid)?.image : undefined,
          tone: item?.tone ?? 0,
          qty: o.items.reduce((s, it) => s + it.qty, 0),
          amount: o.total,
          status: o.status === 'rejected' ? 'Cancelled' : TRACK_STAGES[STATUS_STAGE[o.status]].label,
        },
      },
    });
  };

  if (orders.length === 0) {
    return (
      <div style={css('min-height:100%;background:#FBF6F2;padding-bottom:20px;')}>
        <div style={css('max-width:820px;margin:0 auto;')}>
          <div style={css('padding:4px 0 6px;')}>
            <div className="agx-eyebrow" style={css('font-size:10.5px;color:#B02454;')}>Purchases</div>
            <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(28px,3vw,40px);line-height:1.05;margin-top:4px;")}>My orders</div>
          </div>
          <div style={css('display:flex;flex-direction:column;align-items:center;text-align:center;padding:70px 30px;')}>
            <div style={css('width:82px;height:82px;border-radius:50%;background:linear-gradient(145deg,#FCE0EC,#F7CFDF);display:flex;align-items:center;justify-content:center;box-shadow:inset 0 2px 3px rgba(255,255,255,.7),0 12px 26px -12px rgba(214,51,108,.55);')}>
              <span style={css("font-family:'Material Symbols Outlined';font-size:40px;color:#B02454;")}>receipt_long</span>
            </div>
            <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:26px;margin-top:20px;")}>No orders yet</div>
            <div style={css('color:#8A7078;font-size:14.5px;margin-top:8px;max-width:340px;line-height:1.55;')}>When you place an order it shows up here — track every piece from checkout to your doorstep.</div>
            <button onClick={() => navigate('/buyer/home')} style={css('margin-top:20px;background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;border:none;border-radius:14px;padding:13px 24px;font-weight:800;font-size:14px;cursor:pointer;box-shadow:0 14px 30px -14px rgba(214,51,108,.8);')}>Start shopping</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={css('min-height:100%;background:#FBF6F2;padding-bottom:20px;')}>
      <div style={css('max-width:820px;margin:0 auto;')}>
        <div style={css('padding:4px 0 6px;')}>
          <div className="agx-eyebrow" style={css('font-size:10.5px;color:#B02454;')}>Purchases</div>
          <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(28px,3vw,40px);line-height:1.05;margin-top:4px;")}>My orders</div>
        </div>

        <div style={css('display:flex;flex-direction:column;gap:14px;margin-top:14px;')}>
          {orders.map((o) => {
            const item = o.items[0];
            const extra = o.items.length - 1;
            const delivered = o.status === 'delivered';
            const rejected = o.status === 'rejected';
            const badge = rejected ? 'Cancelled' : TRACK_STAGES[STATUS_STAGE[o.status]].label;
            return (
              <div
                key={o.id}
                onClick={() => navigate(`/buyer/orders/${encodeURIComponent(o.id)}/track`)}
                className="agx-lift"
                style={css('cursor:pointer;background:#fff;border:1px solid #F2E4EA;border-radius:20px;padding:15px;box-shadow:0 16px 36px -30px rgba(107,20,54,.55);')}
              >
                <div style={css('display:flex;align-items:center;justify-content:space-between;gap:10px;')}>
                  <span style={css("font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:600;color:#8A7078;")}>{o.id}</span>
                  <span style={css(`font-size:11px;font-weight:800;padding:5px 11px;border-radius:999px;background:${delivered ? '#E5F3EC' : rejected ? '#FBE3E3' : '#FCE0EC'};color:${delivered ? '#2FA36B' : rejected ? '#C0455E' : '#B02454'};`)}>
                    {badge}
                  </span>
                </div>
                <div style={css('display:flex;gap:14px;margin-top:12px;')}>
                  <div style={css(`position:relative;width:72px;height:90px;flex:none;border-radius:13px;overflow:hidden;background:${TONES[item?.tone ?? 0]};`)}>
                    <ImageSlot src={item ? productById(item.pid)?.image : undefined} placeholder={item?.title} style={css('position:absolute;inset:0;')} />
                  </div>
                  <div style={css('flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;')}>
                    <div style={css('font-weight:800;font-size:15px;line-height:1.2;')}>
                      {item?.title ?? 'Order'}{extra > 0 ? ` +${extra} more` : ''}
                    </div>
                    <div style={css('color:#8A7078;font-size:12.5px;margin-top:3px;')}>{o.boutique} · Qty {o.items.reduce((s, it) => s + it.qty, 0)}</div>
                    <div style={css('display:flex;align-items:center;justify-content:space-between;margin-top:9px;')}>
                      <span style={css("font-family:'Playfair Display',serif;font-weight:700;color:#B02454;font-size:18px;")}>{fmt(o.total)}</span>
                      <span style={css('display:flex;align-items:center;gap:5px;font-size:12px;font-weight:700;color:#5C4650;')}>
                        <span style={css("font-family:'Material Symbols Outlined';font-size:16px;color:#D6336C;")}>event</span>{formatOrderDate(o.placedAt)}
                      </span>
                    </div>
                  </div>
                </div>
                <div style={css('display:flex;gap:10px;margin-top:13px;padding-top:13px;border-top:1px solid #F4E6EC;')}>
                  <button
                    onClick={(e) => { e.stopPropagation(); chatWithBoutique(o); }}
                    style={css('flex:1;height:42px;border:1.5px solid #F0D8E2;background:#fff;color:#B02454;border-radius:13px;font-weight:800;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;')}
                  >
                    <span style={css("font-family:'Material Symbols Outlined';font-size:18px;")}>chat</span>Chat with boutique
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/buyer/orders/${encodeURIComponent(o.id)}/track`); }}
                    style={css('flex:1;height:42px;border:none;background:#FCE0EC;color:#B02454;border-radius:13px;font-weight:800;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;')}
                  >
                    <span style={css("font-family:'Material Symbols Outlined';font-size:18px;")}>local_shipping</span>Track order
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
