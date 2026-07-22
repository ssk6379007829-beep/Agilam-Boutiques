import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { TONES, fmt, statusStyle } from '@/data/demo';
import { useMyBoutique } from '@/hooks/useMyBoutique';
import { useAsync } from '@/hooks/useAsync';
import { fetchOrdersForBoutique } from '@/data/orders';
import { toOrderView } from '@/lib/orderView';

// "To collect" is not a fulfilment status — it is every COD order whose cash is
// still outstanding, which is the list a seller actually chases at end of day.
const TABS = ['All', 'Pending', 'Accepted', 'Shipped', 'Delivered', 'To collect'];

export function Orders() {
  const navigate = useNavigate();
  // The design renders these tabs as static decoration; wiring them up keeps
  // the same visuals but makes the filter actually work.
  const [tab, setTab] = useState('All');
  const { boutique } = useMyBoutique();
  const { data: orderRows, loading } = useAsync(() => (boutique ? fetchOrdersForBoutique(boutique.id) : Promise.resolve([])), [boutique?.id]);

  const all = (orderRows ?? []).map((o, i) => toOrderView(o, i));
  const orders = all.filter((o) =>
    tab === 'All' ? true : tab === 'To collect' ? o.collectAmount > 0 : o.status === tab,
  );
  const outstanding = all.reduce((sum, o) => sum + o.collectAmount, 0);

  return (
    <div style={css('min-height:100%;background:#FBF6F2;padding-bottom:20px;')}>
      <div style={css('padding:6px 20px 8px;')}>
        <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:26px;")}>Orders</div>
      </div>

      {outstanding > 0 && (
        <div
          onClick={() => setTab('To collect')}
          style={css('margin:2px 20px 10px;background:#FFF8E8;border:1px solid #F0DCB4;border-radius:16px;padding:12px 14px;display:flex;align-items:center;gap:11px;cursor:pointer;')}
        >
          <span style={css("font-family:'Material Symbols Outlined';color:#C99A3F;font-size:21px;")}>payments</span>
          <span style={css('flex:1;min-width:0;font-size:13px;font-weight:600;color:#7A5C2A;line-height:1.5;')}>
            <strong>{fmt(outstanding)}</strong> still to collect in cash across your open COD orders.
          </span>
          <span style={css("font-family:'Material Symbols Outlined';color:#C9AE7F;")}>chevron_right</span>
        </div>
      )}

      <div className="agx-scroll" style={css('display:flex;gap:8px;overflow-x:auto;padding:4px 20px 10px;')}>
        {TABS.map((t) => {
          const on = tab === t;
          return (
            <div key={t} onClick={() => setTab(t)} style={css(`flex:none;padding:7px 14px;border-radius:999px;font-size:12.5px;font-weight:700;background:${on ? '#B02454' : '#fff'};color:${on ? '#fff' : '#6B5560'};cursor:pointer;`)}>
              {t}
            </div>
          );
        })}
      </div>

      <div style={css('display:flex;flex-direction:column;gap:10px;padding:0 20px;')}>
        {!loading && orders.length === 0 && (
          <div style={css('color:#8A7078;font-size:14px;padding:8px 2px;')}>No orders in this view yet.</div>
        )}
        {orders.map((o) => {
          const st = statusStyle(o.status);
          return (
            <div key={o.id} onClick={() => navigate(`/seller/orders/${encodeURIComponent(o.id)}`)} style={css('background:#fff;border-radius:16px;padding:13px;cursor:pointer;box-shadow:0 10px 26px -22px rgba(107,20,54,.6);')}>
              <div style={css('display:flex;align-items:center;justify-content:space-between;gap:8px;')}>
                <span style={css('display:flex;align-items:center;gap:7px;')}>
                  <span style={css('font-weight:800;font-size:13px;color:#8A7078;')}>{o.number}</span>
                  {o.channel === 'offline' && (
                    <span style={css('font-size:10px;font-weight:800;padding:2px 8px;border-radius:7px;background:#EAE3F5;color:#7B5FB0;')}>Offline</span>
                  )}
                  {/* Whether the money is already collected decides how the
                      seller hands the parcel over, so it belongs on the list. */}
                  {o.channel === 'online' && o.paymentMethod && (
                    <span style={css(`font-size:10px;font-weight:800;padding:2px 8px;border-radius:7px;background:${o.collectAmount > 0 ? '#FBF0DA' : '#E5F3EC'};color:${o.collectAmount > 0 ? '#B0862B' : '#2FA36B'};`)}>
                      {!o.isCod ? 'Paid' : o.collectAmount > 0 ? `COD · collect ${fmt(o.collectAmount)}` : 'COD · collected'}
                    </span>
                  )}
                </span>
                <span style={css(`font-size:10.5px;font-weight:800;padding:3px 9px;border-radius:8px;background:${st.bg};color:${st.fg};`)}>{o.status}</span>
              </div>
              <div style={css('display:flex;gap:11px;align-items:center;margin-top:10px;')}>
                <div style={css(`width:44px;height:44px;flex:none;border-radius:12px;background:${TONES[o.tone]};position:relative;overflow:hidden;`)}>
                  <div style={css('position:absolute;inset:0;background:repeating-linear-gradient(135deg,rgba(255,255,255,.3) 0 1px,transparent 1px 12px);')} />
                </div>
                <div style={css('flex:1;min-width:0;')}>
                  <div style={css('font-weight:700;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;')}>{o.item}</div>
                  <div style={css('font-size:12px;color:#8A7078;')}>{o.customer} · Qty {o.qty}</div>
                </div>
                <div style={css('font-weight:800;color:#B02454;font-size:15px;')}>{fmt(o.amount)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
