import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { fmt } from '@/data/demo';
import { POLICY_TERMS } from '@/data/company';
import { useMyBoutique } from '@/hooks/useMyBoutique';
import { useAsync } from '@/hooks/useAsync';
import { fetchOrdersForBoutique } from '@/data/orders';
import { fetchBoutiquePrivate } from '@/data/boutiques';
import type { OrderWithDetails } from '@/data/types';

/**
 * Seller earnings, computed from the boutique's own orders.
 *
 * Two money streams are kept apart on purpose, because conflating them would
 * misstate what Agilam actually owes the seller:
 *
 *   • Online orders are collected by Agilam, so commission comes off the top
 *     and the remainder is settled to the seller's payout account.
 *   • Offline / walk-in bills (the POS flow) are collected by the seller
 *     directly — no payout is due and no commission is charged.
 *
 * Rejected orders are excluded throughout: they are not money anyone earned.
 */

const COMMISSION = POLICY_TERMS.commissionPct / 100;
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
};

const startOfPrevMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime();
};

/** Total of the last 7 calendar days, oldest first, for the bar chart. */
function lastSevenDays(orders: OrderWithDetails[]): { label: string; total: number }[] {
  const buckets: { label: string; total: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - i);
    const next = day.getTime() + 24 * 60 * 60 * 1000;
    const total = orders
      .filter((o) => {
        const t = new Date(o.created_at).getTime();
        return t >= day.getTime() && t < next;
      })
      .reduce((s, o) => s + Number(o.total), 0);
    buckets.push({ label: DAY_LABELS[day.getDay()], total });
  }
  return buckets;
}

const maskAccount = (n: string | null) => (n && n.length > 4 ? `•••• ${n.slice(-4)}` : n ?? '');

export function Earnings() {
  const navigate = useNavigate();
  const { boutique } = useMyBoutique();
  const { data: orderRows, loading } = useAsync(
    () => (boutique ? fetchOrdersForBoutique(boutique.id) : Promise.resolve([])),
    [boutique?.id],
  );
  const [payout, setPayout] = useState<{ upi: string | null; account: string | null; ifsc: string | null } | null>(null);
  const boutiqueId = boutique?.id;

  useEffect(() => {
    if (!boutiqueId) return;
    let cancelled = false;
    fetchBoutiquePrivate(boutiqueId)
      .then((p) => {
        if (cancelled || !p) return;
        setPayout({ upi: p.upi_id, account: maskAccount(p.bank_account_number), ifsc: p.bank_ifsc });
      })
      .catch(() => { /* payout destination is supporting detail, never blocking */ });
    return () => { cancelled = true; };
  }, [boutiqueId]);

  const all = (orderRows ?? []).filter((o) => o.status !== 'rejected');
  const monthStart = startOfMonth();
  const prevStart = startOfPrevMonth();
  const at = (o: OrderWithDetails) => new Date(o.created_at).getTime();

  const thisMonth = all.filter((o) => at(o) >= monthStart);
  const lastMonth = all.filter((o) => at(o) >= prevStart && at(o) < monthStart);

  const online = thisMonth.filter((o) => (o.channel ?? 'online') === 'online');
  const offline = thisMonth.filter((o) => o.channel === 'offline');

  const onlineGross = online.reduce((s, o) => s + Number(o.total), 0);
  const offlineCollected = offline.reduce((s, o) => s + Number(o.total), 0);
  const commission = Math.round(onlineGross * COMMISSION);
  const netEarnings = onlineGross - commission;

  // Settled once the buyer has the goods; anything still in flight is money
  // Agilam is holding, which is what the seller wants to see as "pending".
  const settledGross = online.filter((o) => o.status === 'delivered').reduce((s, o) => s + Number(o.total), 0);
  const pendingPayout = Math.round((onlineGross - settledGross) * (1 - COMMISSION));
  const settledPayout = netEarnings - pendingPayout;

  const lastMonthNet = lastMonth
    .filter((o) => (o.channel ?? 'online') === 'online')
    .reduce((s, o) => s + Number(o.total), 0) * (1 - COMMISSION);
  const deltaPct = lastMonthNet > 0 ? Math.round(((netEarnings - lastMonthNet) / lastMonthNet) * 100) : null;

  const bars = lastSevenDays(all);
  const peak = Math.max(...bars.map((b) => b.total), 1);

  const TILES = [
    { label: 'Orders this month', value: String(thisMonth.length), color: '#2A1A20' },
    { label: 'Pending payout', value: fmt(pendingPayout), color: '#C99A3F' },
    { label: 'Settled to you', value: fmt(settledPayout), color: '#2FA36B' },
    { label: `Commission (${POLICY_TERMS.commissionPct}%)`, value: fmt(commission), color: '#8A7078' },
  ];

  return (
    <div style={css('min-height:100%;background:#FBF6F2;padding-bottom:20px;')}>
      <div style={css('padding:6px 0 12px;display:flex;align-items:center;gap:10px;')}>
        <button
          onClick={() => navigate('/seller/profile')}
          style={css('width:42px;height:42px;border-radius:12px;border:none;background:#fff;box-shadow:0 6px 18px -12px rgba(107,20,54,.6);cursor:pointer;display:flex;align-items:center;justify-content:center;')}
        >
          <span style={css("font-family:'Material Symbols Outlined';color:#B02454;")}>arrow_back</span>
        </button>
        <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:26px;")}>Earnings</div>
      </div>

      {/* Hero — net earnings after commission ------------------------------ */}
      <div style={css('border-radius:22px;background:linear-gradient(135deg,#8E1C44 0%,#B02454 52%,#D6336C 100%);color:#fff;padding:22px;position:relative;overflow:hidden;box-shadow:0 20px 44px -26px rgba(176,36,84,.9);')}>
        <div style={css('position:absolute;top:-80px;right:-40px;width:280px;height:280px;border-radius:50%;background:radial-gradient(circle,rgba(244,217,166,.22),transparent 70%);pointer-events:none;')} />
        <div style={css('position:relative;')}>
          <div style={css('font-size:13px;opacity:.85;')}>
            Your earnings · {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </div>
          <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(34px,5vw,44px);line-height:1;margin-top:6px;")}>
            {loading ? '—' : fmt(netEarnings)}
          </div>
          <div style={css('font-size:12.5px;opacity:.82;margin-top:6px;')}>
            {fmt(onlineGross)} in online orders, less {POLICY_TERMS.commissionPct}% Agilam commission
          </div>
          {deltaPct != null && (
            <div style={css('display:flex;gap:6px;align-items:center;margin-top:10px;font-size:13px;font-weight:700;')}>
              <span style={css("font-family:'Material Symbols Outlined';font-size:17px;")}>{deltaPct >= 0 ? 'trending_up' : 'trending_down'}</span>
              {deltaPct >= 0 ? '+' : ''}{deltaPct}% vs last month
            </div>
          )}
        </div>
      </div>

      <div className="agx-sd-quick" style={css('margin-top:14px;')}>
        {TILES.map((t) => (
          <div key={t.label} style={css('background:#fff;border:1px solid #F2E4EA;border-radius:18px;padding:14px;box-shadow:0 14px 32px -28px rgba(107,20,54,.55);')}>
            <div style={css('font-size:11.5px;color:#A98D99;font-weight:700;')}>{t.label}</div>
            <div style={css(`font-family:'Playfair Display',serif;font-weight:700;font-size:24px;line-height:1.1;margin-top:5px;color:${t.color};word-break:break-word;`)}>{t.value}</div>
          </div>
        ))}
      </div>

      {/* Offline takings — collected by the seller, not settled by Agilam --- */}
      {offline.length > 0 && (
        <div style={css('margin-top:14px;background:#F3F9F5;border:1px solid #CFE6D9;border-radius:18px;padding:14px 16px;display:flex;align-items:center;gap:11px;flex-wrap:wrap;')}>
          <span style={css("font-family:'Material Symbols Outlined';color:#2FA36B;")}>storefront</span>
          <span style={css('flex:1;min-width:200px;font-size:13px;font-weight:600;color:#2C6249;line-height:1.5;')}>
            You also collected <strong>{fmt(offlineCollected)}</strong> from {offline.length} walk-in bill{offline.length > 1 ? 's' : ''} this month. Agilam charges no commission on offline sales, so this is yours in full and is not part of the payout above.
          </span>
        </div>
      )}

      {/* Last 7 days -------------------------------------------------------- */}
      <div style={css("padding:22px 0 10px;font-family:'Playfair Display',serif;font-weight:700;font-size:20px;")}>Last 7 days</div>
      <div style={css('background:#fff;border:1px solid #F2E4EA;border-radius:20px;padding:18px 16px;box-shadow:0 14px 32px -28px rgba(107,20,54,.55);')}>
        {peak === 1 && !loading ? (
          <div style={css('padding:14px 4px;text-align:center;color:#8A7078;font-size:13.5px;font-weight:600;')}>
            No sales in the last 7 days yet.
          </div>
        ) : (
          <div style={css('display:flex;align-items:flex-end;gap:10px;height:150px;')}>
            {bars.map((b, i) => (
              <div key={i} title={fmt(b.total)} style={css('flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;justify-content:flex-end;height:100%;')}>
                <span style={css('font-size:10px;color:#B79AA6;font-weight:800;')}>{b.total > 0 ? fmt(b.total) : ''}</span>
                <div style={css(`width:100%;border-radius:7px 7px 3px 3px;background:linear-gradient(180deg,#E7719F,#D6336C);height:${Math.max(3, Math.round((b.total / peak) * 100))}%;`)} />
                <span style={css('font-size:10.5px;color:#B79AA6;font-weight:700;')}>{b.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payout destination -------------------------------------------------- */}
      <div style={css("padding:22px 0 10px;font-family:'Playfair Display',serif;font-weight:700;font-size:20px;")}>Payout account</div>
      <div style={css('background:#fff;border:1px solid #F2E4EA;border-radius:20px;padding:16px 18px;box-shadow:0 14px 32px -28px rgba(107,20,54,.55);')}>
        {payout?.upi || payout?.account ? (
          <div style={css('display:flex;flex-direction:column;gap:9px;')}>
            {payout.upi && (
              <div style={css('display:flex;gap:12px;align-items:baseline;')}>
                <span style={css('flex:none;width:110px;font-size:12px;font-weight:700;color:#A98D99;')}>UPI ID</span>
                <span style={css('font-size:13.5px;font-weight:700;color:#2A1A20;')}>{payout.upi}</span>
              </div>
            )}
            {payout.account && (
              <div style={css('display:flex;gap:12px;align-items:baseline;')}>
                <span style={css('flex:none;width:110px;font-size:12px;font-weight:700;color:#A98D99;')}>Bank account</span>
                <span style={css('font-size:13.5px;font-weight:700;color:#2A1A20;')}>{payout.account}{payout.ifsc ? ` · ${payout.ifsc}` : ''}</span>
              </div>
            )}
            <button
              onClick={() => navigate('/seller/onboarding')}
              style={css('align-self:flex-start;margin-top:4px;border:none;background:none;color:#B02454;font-weight:800;font-size:12.5px;cursor:pointer;display:flex;align-items:center;gap:4px;font-family:inherit;')}
            >
              <span style={css("font-family:'Material Symbols Outlined';font-size:16px;")}>edit</span>Change payout details
            </button>
          </div>
        ) : (
          <div style={css('display:flex;align-items:center;gap:11px;flex-wrap:wrap;')}>
            <span style={css("font-family:'Material Symbols Outlined';color:#C99A3F;")}>account_balance</span>
            <span style={css('flex:1;min-width:180px;font-size:13px;font-weight:600;color:#7A5C2A;line-height:1.5;')}>
              No payout account on file — Agilam cannot settle your online orders until you add one.
            </span>
            <button
              onClick={() => navigate('/seller/onboarding')}
              style={css('height:40px;padding:0 16px;border:none;border-radius:12px;background:#B02454;color:#fff;font-weight:800;font-size:12.5px;cursor:pointer;font-family:inherit;')}
            >
              Add details
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
