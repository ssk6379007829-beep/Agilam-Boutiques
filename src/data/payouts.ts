import { supabase } from '@/lib/supabase';

/**
 * Seller payouts — what the platform owes each boutique after every deduction.
 *
 * The rules live in one place (mirrored server-side in migration 0025's
 * `settle_boutique_payout`, which is the source of truth when money is actually
 * recorded — this module only computes what to *show* the admin):
 *
 *   • The platform take is a flat 10% of goods, already covering the gateway fee
 *     and tax.
 *   • Prepaid orders: platform holds the money → it owes  goods − 10%.
 *   • COD orders: seller holds the cash → seller owes  10% + shipping + COD fee,
 *     netted off the payout (so a boutique can settle to a negative figure).
 *   • Offline / walk-in POS sales are the seller's own till — excluded.
 *
 * An order is settleable once the money is real and un-reversed: paid, not
 * refunded, not rejected/cancelled, and not already stamped with a payout_id.
 */
export const PAYOUT_RATE = 0.1; // commission + gateway + tax, bundled

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface PayoutSummary {
  boutique_id: string;
  name: string;
  tone: number;
  /** Settleable, not-yet-settled order count. */
  orders: number;
  prepaidGoods: number;
  prepaidCommission: number;
  prepaidFees: number;
  codGoods: number;
  codCommission: number;
  codFees: number;
  /** What we owe the seller (goods − commission for prepaid). */
  prepaidPayout: number;
  /** What the seller owes us on COD cash they hold (shown as a positive owed). */
  codOwed: number;
  /** Net payable — can be negative (seller owes the platform). */
  net: number;
}

interface OrderCalcRow {
  boutique_id: string;
  total: number;
  cod_fee: number | null;
  shipping_fee: number | null;
  payment_method: string | null;
  channel: string | null;
  boutique: { name: string; tone: number } | null;
}

/** Per-boutique outstanding balance, ready to settle. */
export async function fetchPayoutSummaries(): Promise<PayoutSummary[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('boutique_id, total, cod_fee, shipping_fee, payment_method, channel, boutique:boutiques(name, tone)')
    .is('payout_id', null)
    .eq('payment_status', 'paid')
    .eq('refunded', false)
    .not('status', 'in', '(rejected,cancelled)');
  if (error) throw error;

  const rows = (data ?? []) as unknown as OrderCalcRow[];
  const map = new Map<string, PayoutSummary>();

  for (const r of rows) {
    if ((r.channel ?? 'online') === 'offline') continue;
    const s =
      map.get(r.boutique_id) ??
      {
        boutique_id: r.boutique_id,
        name: r.boutique?.name ?? 'Boutique',
        tone: r.boutique?.tone ?? 0,
        orders: 0,
        prepaidGoods: 0, prepaidCommission: 0, prepaidFees: 0,
        codGoods: 0, codCommission: 0, codFees: 0,
        prepaidPayout: 0, codOwed: 0, net: 0,
      };

    const goods = Number(r.total);
    const commission = round2(goods * PAYOUT_RATE);
    const fees = Number(r.cod_fee ?? 0) + Number(r.shipping_fee ?? 0);
    s.orders += 1;
    if (r.payment_method === 'COD') {
      s.codGoods += goods;
      s.codCommission += commission;
      s.codFees += fees;
    } else {
      s.prepaidGoods += goods;
      s.prepaidCommission += commission;
      s.prepaidFees += fees;
    }
    map.set(r.boutique_id, s);
  }

  const list = [...map.values()];
  for (const s of list) {
    s.prepaidPayout = round2(s.prepaidGoods - s.prepaidCommission);
    s.codOwed = round2(s.codCommission + s.codFees);
    s.net = round2(s.prepaidPayout - s.codOwed);
  }
  return list.sort((a, b) => b.net - a.net);
}

export type PayoutStatus = 'processing' | 'paid' | 'failed' | 'reversed';
export type PayoutProvider = 'manual' | 'razorpayx';

export interface PayoutRecord {
  id: string;
  boutique_id: string;
  amount: number;
  orders_count: number;
  gross: number;
  commission: number;
  fees: number;
  cod_adjustment: number;
  note: string | null;
  created_by_name: string;
  created_at: string;
  /** 'processing' while RazorpayX moves an automatic payout; 'paid' once done. */
  status: PayoutStatus;
  /** 'razorpayx' for an auto payout, 'manual' for an admin settlement. */
  provider: PayoutProvider;
  method: string | null;
  utr: string | null;
  failure_reason: string | null;
  boutique: { name: string; tone: number } | null;
}

/** Recorded payouts, most recent first. */
export async function fetchPayoutHistory(): Promise<PayoutRecord[]> {
  const { data, error } = await supabase
    .from('payouts')
    .select('id, boutique_id, amount, orders_count, gross, commission, fees, cod_adjustment, note, created_by_name, created_at, status, provider, method, utr, failure_reason, boutique:boutiques(name, tone)')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as unknown as PayoutRecord[];
}

/**
 * Settle a boutique's outstanding balance. The server recomputes the amount from
 * the orders and stamps them, so the returned record is authoritative even if
 * the displayed figure had drifted since the page loaded.
 */
export async function settlePayout(boutiqueId: string, note?: string): Promise<PayoutRecord> {
  const { data, error } = await supabase.rpc('settle_boutique_payout', {
    p_boutique_id: boutiqueId,
    p_note: note ?? null,
  });
  if (error) throw error;
  return data as unknown as PayoutRecord;
}
