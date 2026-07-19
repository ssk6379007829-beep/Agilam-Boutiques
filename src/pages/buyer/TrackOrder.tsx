import { useNavigate, useParams } from 'react-router-dom';
import { css } from '@/lib/css';
import { ImageSlot } from '@/components/ui/ImageSlot';
import { useShop } from '@/state/ShopContext';
import { useCatalog } from '@/state/CatalogContext';
import { TONES, TRACK_STAGES, fmt } from '@/data/demo';
import { findOrder, formatOrderDate, STATUS_STAGE } from '@/lib/orderHistory';

export function TrackOrder() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showToast } = useShop();
  const { productById } = useCatalog();

  const order = findOrder(id ? decodeURIComponent(id) : undefined);

  if (!order) {
    return (
      <div style={css('min-height:100%;background:#FBF6F2;padding-bottom:20px;')}>
        <div style={css('max-width:720px;margin:0 auto;')}>
          <button onClick={() => navigate('/buyer/orders')} style={css('border:none;background:none;cursor:pointer;color:#B02454;font-weight:800;font-size:13.5px;display:flex;align-items:center;gap:6px;padding:6px 0;')}>
            <span style={css("font-family:'Material Symbols Outlined';font-size:18px;")}>arrow_back</span>My orders
          </button>
          <div style={css('display:flex;flex-direction:column;align-items:center;text-align:center;padding:70px 30px;')}>
            <span style={css("font-family:'Material Symbols Outlined';font-size:48px;color:#CBB0BC;")}>search_off</span>
            <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:24px;margin-top:14px;")}>Order not found</div>
            <div style={css('color:#8A7078;font-size:14px;margin-top:8px;')}>We couldn’t find that order.</div>
          </div>
        </div>
      </div>
    );
  }

  const stage = STATUS_STAGE[order.status];
  const rejected = order.status === 'rejected';
  const item = order.items[0];
  const totalQty = order.items.reduce((s, it) => s + it.qty, 0);

  // Open a live chat with this order's boutique, carrying the order as an
  // enquiry card so the seller sees which purchase the message is about.
  const chatWithBoutique = () => {
    navigate(`/buyer/chat/${order.boutiqueId}`, {
      state: {
        order: {
          orderId: order.id,
          title: item?.title ?? 'Order',
          image: item ? productById(item.pid)?.image : undefined,
          tone: item?.tone ?? 0,
          qty: totalQty,
          amount: order.total,
          status: rejected ? 'Cancelled' : TRACK_STAGES[stage].label,
        },
      },
    });
  };

  const steps = TRACK_STAGES.map((st, i) => ({
    ...st,
    dotBg: i <= stage ? '#D6336C' : '#fff',
    dotFg: i <= stage ? '#fff' : '#CBB0BC',
    dotBorder: i <= stage ? '#D6336C' : '#EAD3DD',
    lineBg: i < stage ? '#D6336C' : '#EAD3DD',
    titleColor: i <= stage ? '#241019' : '#B79AA6',
    showLine: i < TRACK_STAGES.length - 1,
    // Only the placed step carries a real timestamp; later steps fill in as the
    // boutique updates the order.
    time: i === 0 ? formatOrderDate(order.placedAt) : '',
  }));

  return (
    <div style={css('min-height:100%;background:#FBF6F2;padding-bottom:20px;')}>
      <div style={css('max-width:720px;margin:0 auto;')}>
        <button onClick={() => navigate('/buyer/orders')} style={css('border:none;background:none;cursor:pointer;color:#B02454;font-weight:800;font-size:13.5px;display:flex;align-items:center;gap:6px;padding:6px 0;')}>
          <span style={css("font-family:'Material Symbols Outlined';font-size:18px;")}>arrow_back</span>My orders
        </button>

        <div style={css('background:linear-gradient(135deg,#8E1C44,#B02454 60%,#D6336C);border-radius:24px;padding:22px;color:#fff;box-shadow:0 24px 50px -30px rgba(176,36,84,.9);position:relative;overflow:hidden;')}>
          <div style={css('position:absolute;top:-60px;right:-30px;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,rgba(244,217,166,.22),transparent 70%);')} />
          <div style={css('display:flex;gap:15px;position:relative;')}>
            <div style={css(`position:relative;width:78px;height:98px;flex:none;border-radius:15px;overflow:hidden;background:${TONES[item?.tone ?? 0]};box-shadow:0 12px 26px -12px rgba(0,0,0,.4);`)}>
              <ImageSlot src={item ? productById(item.pid)?.image : undefined} placeholder={item?.title} style={css('position:absolute;inset:0;')} />
            </div>
            <div style={css('flex:1;min-width:0;')}>
              <div className="agx-eyebrow" style={css('font-size:9px;color:#F4D9A6;')}>{order.id}</div>
              <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:21px;line-height:1.15;margin-top:5px;")}>
                {item?.title ?? 'Order'}{order.items.length > 1 ? ` +${order.items.length - 1} more` : ''}
              </div>
              <div style={css('opacity:.85;font-size:12.5px;margin-top:4px;')}>{order.boutique} · Qty {totalQty} · {fmt(order.total)}</div>
              <div style={css('display:inline-flex;align-items:center;gap:6px;margin-top:11px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:6px 13px;font-size:12.5px;font-weight:800;')}>
                <span style={css("font-family:'Material Symbols Outlined';font-size:16px;color:#F4D9A6;")}>{rejected ? 'cancel' : 'local_shipping'}</span>
                {rejected ? 'Order cancelled' : TRACK_STAGES[stage].label}
              </div>
            </div>
          </div>
        </div>

        <div style={css('background:#fff;border:1px solid #F2E4EA;border-radius:22px;padding:22px 22px 8px;margin-top:16px;box-shadow:0 18px 40px -30px rgba(107,20,54,.55);')}>
          <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:20px;margin-bottom:6px;")}>Order timeline</div>
          {steps.map((st) => (
            <div key={st.label} style={css('display:flex;gap:14px;')}>
              <div style={css('display:flex;flex-direction:column;align-items:center;')}>
                <div style={css(`width:38px;height:38px;flex:none;border-radius:50%;background:${st.dotBg};border:2px solid ${st.dotBorder};display:flex;align-items:center;justify-content:center;`)}>
                  <span style={css(`font-family:'Material Symbols Outlined';font-size:20px;color:${st.dotFg};`)}>{st.icon}</span>
                </div>
                {st.showLine && <span style={css(`width:2.5px;flex:1;min-height:26px;background:${st.lineBg};margin:3px 0;`)} />}
              </div>
              <div style={css('flex:1;padding-bottom:18px;padding-top:6px;')}>
                <div style={css('display:flex;align-items:center;justify-content:space-between;gap:10px;')}>
                  <span style={css(`font-weight:800;font-size:15px;color:${st.titleColor};`)}>{st.label}</span>
                  <span style={css("font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:#8A7078;")}>{st.time}</span>
                </div>
                <div style={css('color:#8A7078;font-size:12.5px;margin-top:2px;')}>{st.sub}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={css('display:flex;gap:12px;margin-top:16px;flex-wrap:wrap;')}>
          <button onClick={chatWithBoutique} style={css('flex:1;min-width:150px;height:52px;border:1.5px solid #F0D8E2;background:#fff;color:#4B3840;border-radius:15px;font-weight:800;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;')}>
            <span style={css("font-family:'Material Symbols Outlined';font-size:20px;color:#25B04A;")}>chat</span>Chat with boutique
          </button>
          <button onClick={() => showToast('Support: hello@agilam.in')} style={css('flex:1;min-width:150px;height:52px;border:1.5px solid #F0D8E2;background:#fff;color:#4B3840;border-radius:15px;font-weight:800;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;')}>
            <span style={css("font-family:'Material Symbols Outlined';font-size:20px;color:#B02454;")}>support_agent</span>Need help?
          </button>
        </div>
      </div>
    </div>
  );
}
