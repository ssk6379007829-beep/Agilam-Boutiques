import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { TONES, fmt, statusStyle } from '@/data/demo';
import { useMyBoutique } from '@/hooks/useMyBoutique';
import { useAsync } from '@/hooks/useAsync';
import { fetchOrdersForBoutique } from '@/data/orders';
import { toOrderView } from '@/lib/orderView';

type CustomerGroup = {
  key: string;
  name: string;
  city: string | null;
  orders: { id: string; number: string; item: string; amount: number; status: string; date: string; at: number }[];
  spent: number;
  lastAt: number;
  tone: number;
};

const fmtDate = (at: number) =>
  new Date(at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Customer Orders — the boutique's buyers grouped from their orders, so the
 * seller sees who they are, how much they've spent, when they last bought, and
 * can open the full history for any one of them. Registered buyers group by
 * account; anonymous guests by phone (falling back to name).
 */
export function Customers() {
  const navigate = useNavigate();
  const { boutique } = useMyBoutique();
  const { data: orderRows, loading } = useAsync(() => (boutique ? fetchOrdersForBoutique(boutique.id) : Promise.resolve([])), [boutique?.id]);
  const [open, setOpen] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const groups = useMemo<CustomerGroup[]>(() => {
    const map = new Map<string, CustomerGroup>();
    (orderRows ?? []).forEach((o, i) => {
      const v = toOrderView(o, i);
      const key = o.buyer_id ?? `guest:${o.guest_phone ?? o.guest_name ?? o.id}`;
      const at = new Date(o.created_at).getTime();
      const g = map.get(key);
      const line = { id: v.id, number: v.number, item: v.item, amount: v.amount, status: v.status, date: v.date, at };
      if (g) {
        g.orders.push(line);
        g.spent += v.amount;
        g.lastAt = Math.max(g.lastAt, at);
      } else {
        map.set(key, { key, name: v.customer, city: v.city, orders: [line], spent: v.amount, lastAt: at, tone: i % 8 });
      }
    });
    return [...map.values()]
      .map((g) => ({ ...g, orders: g.orders.sort((a, b) => b.at - a.at) }))
      .sort((a, b) => b.lastAt - a.lastAt);
  }, [orderRows]);

  const q = search.trim().toLowerCase();
  const shown = q ? groups.filter((g) => g.name.toLowerCase().includes(q)) : groups;

  return (
    <div style={css('min-height:100%;background:#FBF6F2;padding-bottom:20px;')}>
      <div style={css('padding:6px 20px 10px;display:flex;align-items:center;gap:10px;')}>
        <button onClick={() => navigate('/seller/profile')} aria-label="Back" style={css('width:42px;height:42px;border-radius:12px;border:none;background:#fff;box-shadow:0 6px 18px -12px rgba(107,20,54,.6);cursor:pointer;display:flex;align-items:center;justify-content:center;')}>
          <span style={css("font-family:'Material Symbols Outlined';color:#B02454;")}>arrow_back</span>
        </button>
        <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:26px;")}>Customer Orders</div>
      </div>

      {groups.length > 0 && (
        <div style={css('padding:0 20px 10px;')}>
          <div style={css('display:flex;align-items:center;gap:9px;background:#fff;border:1px solid #F0E2E9;border-radius:14px;padding:0 14px;height:46px;')}>
            <span style={css("font-family:'Material Symbols Outlined';color:#B79AA6;font-size:20px;")}>search</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer name" style={css('flex:1;border:none;outline:none;background:none;font-family:inherit;font-size:14px;color:#2A1A20;')} />
          </div>
        </div>
      )}

      <div style={css('display:flex;flex-direction:column;gap:10px;padding:4px 20px 0;')}>
        {!loading && shown.length === 0 && (
          <div style={css('color:#8A7078;font-size:14px;padding:8px 2px;')}>{q ? 'No customers match.' : 'No customers yet.'}</div>
        )}
        {shown.map((c) => {
          const isOpen = open === c.key;
          return (
            <div key={c.key} style={css('background:#fff;border-radius:16px;padding:12px;box-shadow:0 10px 26px -22px rgba(107,20,54,.6);')}>
              <div onClick={() => setOpen(isOpen ? null : c.key)} style={css('display:flex;gap:11px;align-items:center;cursor:pointer;')}>
                <div style={css(`width:48px;height:48px;flex:none;border-radius:14px;background:${TONES[c.tone]};display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-weight:700;font-size:20px;color:rgba(42,26,32,.5);`)}>{c.name[0]?.toUpperCase()}</div>
                <div style={css('flex:1;min-width:0;')}>
                  <div style={css('font-weight:800;font-size:14px;')}>{c.name}</div>
                  <div style={css('font-size:12px;color:#8A7078;')}>{c.orders.length} order{c.orders.length === 1 ? '' : 's'} · Last {fmtDate(c.lastAt)}</div>
                </div>
                <div style={css('text-align:right;flex:none;')}>
                  <div style={css('font-weight:800;color:#B02454;font-size:14px;')}>{fmt(c.spent)}</div>
                  <div style={css('font-size:11px;color:#B79AA6;')}>lifetime</div>
                </div>
                <span style={css(`font-family:'Material Symbols Outlined';color:#CBB0BC;transition:transform .2s;transform:rotate(${isOpen ? 180 : 0}deg);`)}>expand_more</span>
              </div>

              {isOpen && (
                <div style={css('margin-top:10px;padding-top:10px;border-top:1px solid #F5E4EC;display:flex;flex-direction:column;gap:8px;')}>
                  <div style={css('font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#8A7078;')}>Order history</div>
                  {c.orders.map((o) => {
                    const st = statusStyle(o.status);
                    return (
                      <div key={o.id} onClick={() => navigate(`/seller/orders/${encodeURIComponent(o.id)}`)} style={css('display:flex;align-items:center;gap:10px;padding:8px;border-radius:12px;background:#FBF6F2;cursor:pointer;')}>
                        <div style={css('flex:1;min-width:0;')}>
                          <div style={css('font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;')}>{o.item}</div>
                          <div style={css('font-size:11.5px;color:#8A7078;')}>{o.number} · {o.date}</div>
                        </div>
                        <span style={css(`font-size:10px;font-weight:800;padding:2px 8px;border-radius:7px;background:${st.bg};color:${st.fg};`)}>{o.status}</span>
                        <div style={css('font-weight:800;color:#B02454;font-size:13px;')}>{fmt(o.amount)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
