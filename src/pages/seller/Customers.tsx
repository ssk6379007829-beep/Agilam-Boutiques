import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { TONES, fmt } from '@/data/demo';
import { useMyBoutique } from '@/hooks/useMyBoutique';
import { useAsync } from '@/hooks/useAsync';
import { fetchCustomersForBoutique } from '@/data/orders';

export function Customers() {
  const navigate = useNavigate();
  const { boutique } = useMyBoutique();
  const { data: rows, loading } = useAsync(() => (boutique ? fetchCustomersForBoutique(boutique.id) : Promise.resolve([])), [boutique?.id]);
  const CUSTOMERS = (rows ?? []).map((c) => ({ name: c.name, city: c.city ?? '—', orders: c.orders, spent: c.spent, tone: c.tone }));

  return (
    <div style={css('min-height:100%;background:#FBF6F2;padding-bottom:20px;')}>
      <div style={css('padding:6px 20px 12px;display:flex;align-items:center;gap:10px;')}>
        <button onClick={() => navigate('/seller/profile')} style={css('width:42px;height:42px;border-radius:12px;border:none;background:#fff;box-shadow:0 6px 18px -12px rgba(107,20,54,.6);cursor:pointer;display:flex;align-items:center;justify-content:center;')}>
          <span style={css("font-family:'Material Symbols Outlined';color:#B02454;")}>arrow_back</span>
        </button>
        <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:26px;")}>Customers</div>
      </div>

      <div style={css('display:flex;flex-direction:column;gap:10px;padding:4px 20px 0;')}>
        {!loading && CUSTOMERS.length === 0 && (
          <div style={css('color:#8A7078;font-size:14px;padding:8px 2px;')}>No customers yet.</div>
        )}
        {CUSTOMERS.map((c) => (
          <div key={c.name} style={css('background:#fff;border-radius:16px;padding:12px;display:flex;gap:11px;align-items:center;box-shadow:0 10px 26px -22px rgba(107,20,54,.6);')}>
            <div style={css(`width:48px;height:48px;flex:none;border-radius:14px;background:${TONES[c.tone]};display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-weight:700;font-size:20px;color:rgba(42,26,32,.5);`)}>{c.name[0]}</div>
            <div style={css('flex:1;')}>
              <div style={css('font-weight:800;font-size:14px;')}>{c.name}</div>
              <div style={css('font-size:12px;color:#8A7078;')}>{c.city} · {c.orders} orders</div>
            </div>
            <div style={css('text-align:right;')}>
              <div style={css('font-weight:800;color:#B02454;font-size:14px;')}>{fmt(c.spent)}</div>
              <div style={css('font-size:11px;color:#B79AA6;')}>lifetime</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
