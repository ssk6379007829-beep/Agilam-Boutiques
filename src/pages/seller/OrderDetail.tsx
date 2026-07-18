import { useNavigate, useParams } from 'react-router-dom';
import { css } from '@/lib/css';
import { useShop } from '@/state/ShopContext';
import { TONES, fmt } from '@/data/demo';
import { useAsync } from '@/hooks/useAsync';
import { fetchOrder, updateOrderStatus } from '@/data/orders';
import { toOrderView } from '@/lib/orderView';

export function OrderDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showToast } = useShop();

  const orderId = decodeURIComponent(id ?? '');
  const { data: row, loading, reload } = useAsync(() => (orderId ? fetchOrder(orderId) : Promise.resolve(null)), [orderId]);

  if (!row) {
    return (
      <div style={css('min-height:60vh;display:flex;align-items:center;justify-content:center;color:#8A7078;font-size:15px;')}>
        {loading ? 'Loading order…' : 'Order not found.'}
      </div>
    );
  }

  const o = toOrderView(row);
  const subtotal = o.amount;

  const setStatus = async (status: 'shipped' | 'delivered' | 'rejected', msg: string) => {
    try {
      await updateOrderStatus(o.id, status);
      showToast(msg);
      reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Update failed');
    }
  };

  return (
    <div style={css('min-height:100%;background:#FBF6F2;display:flex;flex-direction:column;')}>
      <div style={css('padding:6px 20px 12px;display:flex;align-items:center;gap:10px;')}>
        <button onClick={() => navigate('/seller/orders')} style={css('width:42px;height:42px;border-radius:12px;border:none;background:#fff;box-shadow:0 6px 18px -12px rgba(107,20,54,.6);cursor:pointer;display:flex;align-items:center;justify-content:center;')}>
          <span style={css("font-family:'Material Symbols Outlined';color:#B02454;")}>arrow_back</span>
        </button>
        <div>
          <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:22px;line-height:1;")}>Order {o.number}</div>
          <div style={css('font-size:12px;color:#8A7078;')}>Placed {o.date} · {o.status}</div>
        </div>
      </div>

      <div style={css('flex:1;padding:4px 20px 0;')}>
        <div style={css('background:#fff;border-radius:16px;padding:14px;box-shadow:0 10px 26px -22px rgba(107,20,54,.6);')}>
          <div style={css('font-size:12px;font-weight:800;color:#8A7078;letter-spacing:.05em;')}>CUSTOMER</div>
          <div style={css('display:flex;align-items:center;gap:11px;margin-top:8px;')}>
            <div style={css("width:44px;height:44px;border-radius:13px;background:#F4D6E2;display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-weight:700;color:rgba(42,26,32,.5);")}>{o.customer[0]}</div>
            <div style={css('flex:1;')}>
              <div style={css('font-weight:800;font-size:14px;')}>{o.customer}</div>
              <div style={css('font-size:12px;color:#8A7078;')}>{[o.city, o.phone].filter(Boolean).join(' · ') || 'Customer'}</div>
            </div>
            <button onClick={() => navigate('/seller/messages')} style={css('width:38px;height:38px;border-radius:11px;border:none;background:#FCE0EC;cursor:pointer;display:flex;align-items:center;justify-content:center;')}>
              <span style={css("font-family:'Material Symbols Outlined';color:#D6336C;")}>chat</span>
            </button>
          </div>
        </div>

        <div style={css('background:#fff;border-radius:16px;padding:14px;margin-top:12px;box-shadow:0 10px 26px -22px rgba(107,20,54,.6);')}>
          <div style={css('font-size:12px;font-weight:800;color:#8A7078;letter-spacing:.05em;')}>ITEM</div>
          <div style={css('display:flex;gap:11px;align-items:center;margin-top:8px;')}>
            <div style={css(`width:56px;height:56px;flex:none;border-radius:13px;background:${TONES[o.tone]};position:relative;overflow:hidden;`)}>
              <div style={css('position:absolute;inset:0;background:repeating-linear-gradient(135deg,rgba(255,255,255,.3) 0 1px,transparent 1px 12px);')} />
            </div>
            <div style={css('flex:1;')}>
              <div style={css('font-weight:700;font-size:13.5px;')}>{o.item}</div>
              <div style={css('font-size:12px;color:#8A7078;')}>Size {o.size ?? 'Free'} · {o.color ?? '—'} · Qty {o.qty}</div>
            </div>
            <div style={css('font-weight:800;color:#B02454;')}>{fmt(o.amount)}</div>
          </div>
          <div style={css('border-top:1px solid #F5E4EC;margin-top:12px;padding-top:10px;display:flex;justify-content:space-between;font-size:13px;color:#8A7078;')}>
            <span>Subtotal</span><span style={css('font-weight:700;color:#2A1A20;')}>{fmt(subtotal)}</span>
          </div>
          <div style={css('display:flex;justify-content:space-between;font-size:13px;color:#8A7078;margin-top:4px;')}>
            <span>Delivery</span><span style={css('font-weight:700;color:#2FA36B;')}>Free</span>
          </div>
          <div style={css('display:flex;justify-content:space-between;margin-top:8px;font-weight:800;font-size:15px;')}>
            <span>Total</span><span style={css('color:#B02454;')}>{fmt(subtotal)}</span>
          </div>
        </div>
      </div>

      <div style={css('position:sticky;bottom:0;background:#FBF6F2;padding:12px 20px 16px;display:flex;gap:10px;')}>
        <button onClick={() => setStatus('rejected', 'Order rejected')} style={css('flex:1;height:52px;border:1.5px solid #E7A7B4;background:#fff;color:#D6455A;border-radius:14px;font-weight:800;cursor:pointer;')}>Reject</button>
        <button onClick={() => setStatus('delivered', 'Marked delivered')} style={css('flex:1;height:52px;border:1.5px solid #D6336C;background:#fff;color:#B02454;border-radius:14px;font-weight:800;cursor:pointer;')}>Delivered</button>
        <button onClick={() => setStatus('shipped', 'Marked as shipped')} style={css('flex:1.4;height:52px;border:none;border-radius:14px;background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;font-weight:800;cursor:pointer;')}>Mark Shipped</button>
      </div>
    </div>
  );
}
