import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { createClient } from '@supabase/supabase-js';
import { computeTotals } from './_pricing.js';
import { enforceRateLimit } from './_rateLimit.js';

/**
 * Vercel serverless function: create the real order(s) for a guest checkout.
 *
 * Buyers browse without an account, so orders are written here with the Supabase
 * service role (bypasses RLS) instead of from the anonymous browser client. The
 * server is the source of truth for prices and boutique ownership: the client
 * only sends product ids + quantities, and we look up the authoritative title,
 * price and boutique from the products table. A cart can span several
 * boutiques, so it is split into one order per boutique — that is what makes
 * each seller see only their own items.
 *
 * For online payments we re-verify the Razorpay signature here (the same HMAC
 * as verify-payment.js) so an order can't be forged without a genuine payment.
 */

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function verifySignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  if (!keySecret || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return false;
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(razorpay_signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function orderNumber() {
  return 'AGL-' + Date.now().toString().slice(-7) + Math.floor(Math.random() * 10);
}

// Auto-refund a captured payment we've decided not to fulfil (wrong amount, or
// stock sold out between pay and placement). A failed refund must never crash
// order handling — it's logged for manual follow-up instead.
async function refundPayment(razorpay, paymentId, amountPaise) {
  if (!razorpay || !paymentId || !(amountPaise > 0)) return;
  try {
    await razorpay.payments.refund(paymentId, { amount: amountPaise, speed: 'optimum' });
  } catch (e) {
    console.error('place-order: auto-refund failed for', paymentId, e?.error ?? e);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await enforceRateLimit(req, res, { key: 'place-order', limit: 20, windowMs: 60_000 }))) return;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Order service is not configured (missing Supabase service role)' });
  }

  const { items, guest, payment, couponCode } = req.body ?? {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  // Online payment must carry a valid signature; a null payment means Cash on Delivery.
  if (payment && !verifySignature(payment)) {
    return res.status(400).json({ error: 'Payment could not be verified' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // One Razorpay client, reused for order lookup (amount binding) and any
  // auto-refund. Null for Cash on Delivery / when keys aren't configured.
  const razorpay = keyId && keySecret ? new Razorpay({ key_id: keyId, key_secret: keySecret }) : null;

  // Replay guard: a genuine online payment maps to exactly one order-set. Without
  // this, replaying the same verified {order_id, payment_id, signature} to this
  // endpoint would mint unlimited orders from a single payment. The multi-boutique
  // split still shares one payment_id across the rows created in THIS request —
  // we only reject a payment_id that already exists from a PRIOR request.
  const paymentId = payment?.razorpay_payment_id ?? null;
  if (paymentId) {
    const { data: dup, error: dupErr } = await supabase
      .from('orders')
      .select('id')
      .eq('payment_id', paymentId)
      .limit(1)
      .maybeSingle();
    if (dupErr) {
      console.error('place-order replay check failed:', dupErr?.message ?? dupErr);
      return res.status(500).json({ error: 'Could not place the order. Please try again.' });
    }
    if (dup) {
      return res.status(409).json({ error: 'This payment has already been used for an order.' });
    }
  }

  // A signed-in buyer (Google / email) sends their access token; tie the order
  // to their account so they can read it back cross-device via RLS. Guests
  // (no token / invalid) fall through to null, staying phone-keyed.
  let buyerId = null;
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (token) {
    try {
      const { data } = await supabase.auth.getUser(token);
      buyerId = data?.user?.id ?? null;
    } catch {
      /* invalid token — treat as a guest checkout */
    }
  }

  try {
    // Authoritative product data — never trust prices sent by the browser.
    const ids = [...new Set(items.map((it) => it?.product_id).filter(Boolean))];
    if (ids.length === 0) return res.status(400).json({ error: 'No valid products in cart' });

    const { data: products, error: prodErr } = await supabase
      .from('products')
      .select('id, title, price, color, boutique_id')
      .in('id', ids);
    if (prodErr) throw prodErr;

    const byId = new Map((products ?? []).map((p) => [p.id, p]));

    // Group order lines by boutique so each seller gets their own order.
    const groups = new Map();
    for (const it of items) {
      const p = byId.get(it?.product_id);
      if (!p) continue; // unknown/removed product — skip
      const qty = Math.max(1, Math.floor(Number(it.qty) || 1));
      const line = {
        product_id: p.id,
        title: p.title,
        price: Number(p.price),
        qty,
        size: it.size ?? null,
        color: p.color ?? null,
      };
      const g = groups.get(p.boutique_id) ?? { boutique_id: p.boutique_id, lines: [], total: 0 };
      g.lines.push(line);
      g.total += line.price * qty;
      groups.set(p.boutique_id, g);
    }

    if (groups.size === 0) {
      return res.status(400).json({ error: 'None of the cart items are still available' });
    }

    // ── Payment amount binding (critical) ──────────────────────────────────
    // For online orders, prove the buyer actually PAID the amount they owe.
    // The subtotal is the server-priced goods value; the coupon + shipping are
    // re-derived here from the same rules the browser used, giving the exact
    // paise the Razorpay order must have been created and paid for. This closes
    // the underpayment hole: a ₹1 Razorpay order can't settle a ₹50,000 cart,
    // because order.amount won't match and status won't be 'paid'.
    let refundAmountPaise = 0;
    if (payment) {
      if (!razorpay) {
        return res.status(500).json({ error: 'Payment verification is not configured' });
      }
      const subtotal = [...groups.values()].reduce((sum, g) => sum + g.total, 0);
      const expectedPaise = computeTotals(subtotal, couponCode).totalPaise;

      let rzOrder;
      try {
        rzOrder = await razorpay.orders.fetch(payment.razorpay_order_id);
      } catch (e) {
        console.error('place-order: could not fetch Razorpay order:', e?.error ?? e);
        return res.status(502).json({ error: 'Could not confirm the payment. Please contact support before retrying.' });
      }

      if (rzOrder?.status !== 'paid') {
        return res.status(400).json({ error: 'Payment is not marked as paid' });
      }
      // The amount actually captured — refunded in full if we can't honour it.
      refundAmountPaise = Number(rzOrder.amount_paid ?? rzOrder.amount) || expectedPaise;
      if (Number(rzOrder.amount) !== expectedPaise) {
        console.error('place-order: amount mismatch', { paid: rzOrder?.amount, expectedPaise });
        await refundPayment(razorpay, payment.razorpay_payment_id, refundAmountPaise);
        return res.status(400).json({ error: 'Paid amount did not match the order total; your payment has been refunded.' });
      }
    }

    // ── Inventory reservation (H-03) ───────────────────────────────────────
    // Atomically decrement stock for every line before writing the order.
    // All-or-nothing: if any item is short, nothing is decremented. If the
    // buyer already paid (online) and stock sold out in the meantime, refund
    // rather than oversell.
    const reserveItems = [];
    for (const g of groups.values()) {
      for (const l of g.lines) reserveItems.push({ product_id: l.product_id, qty: l.qty });
    }

    const { error: reserveErr } = await supabase.rpc('reserve_stock', { p_items: reserveItems });
    if (reserveErr) {
      const soldOut = String(reserveErr.message || '').includes('INSUFFICIENT_STOCK');
      if (!soldOut) console.error('place-order: stock reservation failed:', reserveErr?.message ?? reserveErr);
      if (payment) await refundPayment(razorpay, payment.razorpay_payment_id, refundAmountPaise);
      return res.status(soldOut ? 409 : 500).json({
        error: soldOut
          ? `Sorry, some items just sold out.${payment ? ' Your payment has been refunded.' : ''}`
          : 'Could not place the order. Please try again.',
      });
    }

    const guestFields = {
      guest_name: guest?.name ?? null,
      guest_phone: guest?.phone ?? null,
      guest_city: guest?.city ?? null,
      guest_address: guest?.address ?? null,
      payment_id: payment?.razorpay_payment_id ?? null,
    };

    // Stock is now reserved — if the order rows fail to write, put it back
    // (and refund) so a failed write can't silently eat inventory or money.
    const created = [];
    try {
      for (const g of groups.values()) {
        const { data: order, error: orderErr } = await supabase
          .from('orders')
          .insert({
            order_number: orderNumber(),
            buyer_id: buyerId,
            boutique_id: g.boutique_id,
            total: g.total,
            status: 'pending',
            ...guestFields,
          })
          .select('id, order_number, boutique_id')
          .single();
        if (orderErr) throw orderErr;

        const { error: itemsErr } = await supabase
          .from('order_items')
          .insert(g.lines.map((l) => ({ ...l, order_id: order.id })));
        if (itemsErr) throw itemsErr;

        created.push({ order_number: order.order_number, boutique_id: order.boutique_id });
      }
    } catch (writeErr) {
      console.error('place-order: order write failed after reservation:', writeErr?.message ?? writeErr);
      await supabase.rpc('release_stock', { p_items: reserveItems }).catch(() => {});
      if (payment) await refundPayment(razorpay, payment.razorpay_payment_id, refundAmountPaise);
      return res.status(500).json({ error: 'Could not place the order. Please try again.' });
    }

    return res.status(200).json({ orders: created });
  } catch (err) {
    console.error('place-order failed:', err?.message ?? err);
    return res.status(500).json({ error: 'Could not place the order. Please try again.' });
  }
}
