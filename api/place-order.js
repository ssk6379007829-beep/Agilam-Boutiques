import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { serviceClient } from './_supabase.js';
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

/**
 * Drop a "New order" notification into each seller's inbox (the bell on
 * /seller/notifications). One row per boutique order, addressed to the
 * boutique's owner profile.
 *
 * Written with the service role because the buyer is anonymous and could never
 * satisfy an RLS insert policy on someone else's notifications. Entirely
 * best-effort: the order is already placed and paid for by the time this runs,
 * so a failure here is logged, never surfaced.
 */
async function notifySellers(supabase, created, guestFields) {
  try {
    const boutiqueIds = [...new Set(created.map((o) => o.boutique_id))];
    const { data: boutiques, error } = await supabase
      .from('boutiques')
      .select('id, owner_id')
      .in('id', boutiqueIds);
    if (error) throw error;

    const ownerById = new Map((boutiques ?? []).map((b) => [b.id, b.owner_id]));
    const rows = [];
    for (const order of created) {
      const ownerId = ownerById.get(order.boutique_id);
      if (!ownerId) continue;
      const units = order.lines.reduce((sum, l) => sum + l.qty, 0);
      const first = order.lines[0];
      const rest = order.lines.length > 1 ? ` +${order.lines.length - 1} more` : '';
      const buyer = guestFields.guest_name || 'A customer';
      rows.push({
        profile_id: ownerId,
        type: 'Orders',
        title: `New order ${order.order_number} · ₹${Math.round(order.total)}`,
        body: `${buyer} ordered ${units} item${units === 1 ? '' : 's'} — ${first?.title ?? 'Item'}${rest}. Payment: ${guestFields.payment_method}.`,
        order_id: order.id,
      });
    }
    if (rows.length === 0) return;

    const { error: insErr } = await supabase.from('notifications').insert(rows);
    if (insErr) throw insErr;
  } catch (err) {
    console.error('place-order: seller notification failed (order still placed):', err?.message ?? err);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await enforceRateLimit(req, res, { key: 'place-order', limit: 20, windowMs: 60_000 }))) return;

  // Built before anything else touches the network: a misconfigured environment
  // must fail here, with a diagnosable message, rather than after the buyer's
  // card has been charged.
  const supabase = serviceClient(supabaseUrl, serviceRoleKey);
  if (!supabase) {
    console.error('place-order: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing or blank');
    return res.status(500).json({ error: 'Order service is not configured (missing Supabase service role)' });
  }

  const { items, guest, payment, couponCode } = req.body ?? {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  // Every order is prepaid — there is no Cash on Delivery. An order without a
  // gateway-signed payment is rejected outright, so this endpoint can never be
  // used to mint an unpaid order.
  if (!payment) {
    return res.status(400).json({ error: 'Payment is required to place an order' });
  }
  if (!verifySignature(payment)) {
    return res.status(400).json({ error: 'Payment could not be verified' });
  }

  // One Razorpay client, reused for order lookup (amount binding) and any
  // auto-refund. Null when the keys aren't configured.
  const razorpay = keyId && keySecret ? new Razorpay({ key_id: keyId, key_secret: keySecret }) : null;

  // Replay guard: a genuine online payment maps to exactly one order-set. Without
  // this, replaying the same verified {order_id, payment_id, signature} to this
  // endpoint would mint unlimited orders from a single payment. The multi-boutique
  // split still shares one payment_id across the rows created in THIS request —
  // we only reject a payment_id that already exists from a PRIOR request.
  const { data: dup, error: dupErr } = await supabase
    .from('orders')
    .select('id')
    .eq('payment_id', payment.razorpay_payment_id)
    .limit(1)
    .maybeSingle();
  if (dupErr) {
    console.error('place-order replay check failed:', dupErr?.message ?? dupErr);
    return res.status(500).json({ error: 'Could not place the order. Please try again.' });
  }
  if (dup) {
    return res.status(409).json({ error: 'This payment has already been used for an order.' });
  }

  // A signed-in buyer (Google / email) sends their access token; tie the order
  // to their account so they can read it back cross-device via RLS. Guests
  // (no token / invalid) fall through to null, staying phone-keyed.
  let buyerId = null;
  // Optional-chained on purpose: a runtime without `headers` must degrade to a
  // guest checkout, never throw here — this runs after the buyer has paid.
  const authHeader = req.headers?.authorization || '';
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
    // Prove the buyer actually PAID the amount they owe. The subtotal is the
    // server-priced goods value; the coupon + shipping are re-derived here from
    // the same rules the browser used, giving the exact paise the payment must
    // carry. This closes the underpayment hole: a ₹1 payment can't settle a
    // ₹50,000 cart.
    //
    // The check is made against the PAYMENT rather than the order, because the
    // parent order only flips to 'paid' once Razorpay has captured. On an
    // account set to manual capture it never does on its own, and even on
    // auto-capture the flip can trail this request — either way a real, fully
    // authorised payment would be rejected here and the buyer left charged with
    // no order. So: bind the payment to our order id, assert the amount, and
    // capture it ourselves if it is still merely authorised.
    let refundAmountPaise = 0;
    if (!razorpay) {
      return res.status(500).json({ error: 'Payment verification is not configured' });
    }
    const subtotal = [...groups.values()].reduce((sum, g) => sum + g.total, 0);
    const expectedPaise = computeTotals(subtotal, couponCode).totalPaise;

    let rzPayment;
    try {
      rzPayment = await razorpay.payments.fetch(payment.razorpay_payment_id);
    } catch (e) {
      console.error('place-order: could not fetch Razorpay payment:', e?.error ?? e);
      return res.status(502).json({ error: 'Could not confirm the payment. Please contact support before retrying.' });
    }

    // The signature proves this payment/order pair was signed by Razorpay;
    // this proves the payment really belongs to the order id we were handed.
    if (rzPayment?.order_id !== payment.razorpay_order_id) {
      console.error('place-order: payment/order mismatch', {
        paymentOrder: rzPayment?.order_id,
        claimed: payment.razorpay_order_id,
      });
      return res.status(400).json({ error: 'Payment could not be verified' });
    }

    const paidPaise = Number(rzPayment.amount) || 0;
    // What we'd hand back if we can't honour the order — always the real
    // amount on the payment, never the amount we merely expected.
    refundAmountPaise = paidPaise;

    if (rzPayment.status === 'failed' || rzPayment.status === 'refunded') {
      return res.status(400).json({ error: 'That payment did not go through. Please try again.' });
    }
    if (rzPayment.status !== 'captured' && rzPayment.status !== 'authorized') {
      return res.status(400).json({ error: 'Payment is not confirmed yet. Please wait a moment and try again.' });
    }
    if (paidPaise !== expectedPaise || rzPayment.currency !== 'INR') {
      console.error('place-order: amount mismatch', { paidPaise, expectedPaise, currency: rzPayment.currency });
      await refundPayment(razorpay, payment.razorpay_payment_id, refundAmountPaise);
      return res.status(400).json({ error: 'Paid amount did not match the order total; your payment has been refunded.' });
    }

    // Authorised but not captured — take the money now that we know the cart
    // and amount are good. A concurrent capture (auto-capture winning the
    // race) makes this a no-op error, which we treat as success by re-reading.
    if (rzPayment.status === 'authorized') {
      try {
        await razorpay.payments.capture(payment.razorpay_payment_id, expectedPaise, 'INR');
      } catch (e) {
        let captured = false;
        try {
          const after = await razorpay.payments.fetch(payment.razorpay_payment_id);
          captured = after?.status === 'captured';
        } catch {
          /* fall through to the failure below */
        }
        if (!captured) {
          console.error('place-order: capture failed:', e?.error ?? e);
          return res.status(502).json({ error: 'Could not confirm the payment. Please contact support before retrying.' });
        }
      }
    }

    // ── Inventory reservation (H-03) ───────────────────────────────────────
    // Atomically decrement stock for every line before writing the order.
    // All-or-nothing: if any item is short, nothing is decremented. The buyer
    // has already paid by this point, so if stock sold out in the meantime we
    // refund rather than oversell.
    const reserveItems = [];
    for (const g of groups.values()) {
      for (const l of g.lines) reserveItems.push({ product_id: l.product_id, qty: l.qty });
    }

    const { error: reserveErr } = await supabase.rpc('reserve_stock', { p_items: reserveItems });
    if (reserveErr) {
      const soldOut = String(reserveErr.message || '').includes('INSUFFICIENT_STOCK');
      if (!soldOut) console.error('place-order: stock reservation failed:', reserveErr?.message ?? reserveErr);
      await refundPayment(razorpay, payment.razorpay_payment_id, refundAmountPaise);
      return res.status(soldOut ? 409 : 500).json({
        error: soldOut
          ? 'Sorry, some items just sold out. Your payment has been refunded.'
          : 'Could not place the order. Please try again.',
      });
    }

    const guestFields = {
      guest_name: guest?.name ?? null,
      guest_phone: guest?.phone ?? null,
      guest_city: guest?.city ?? null,
      guest_address: guest?.address ?? null,
      payment_id: payment.razorpay_payment_id,
      // Orders are prepaid, so the money is always settled by the time the
      // seller sees this — nothing is collected at the door.
      payment_method: 'Razorpay',
      channel: 'online',
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
          .select('id, order_number, boutique_id, total, created_at')
          .single();
        if (orderErr) throw orderErr;

        const { error: itemsErr } = await supabase
          .from('order_items')
          .insert(g.lines.map((l) => ({ ...l, order_id: order.id })));
        if (itemsErr) throw itemsErr;

        created.push({
          id: order.id,
          order_number: order.order_number,
          boutique_id: order.boutique_id,
          total: Number(order.total),
          created_at: order.created_at,
          lines: g.lines,
        });
      }
    } catch (writeErr) {
      console.error('place-order: order write failed after reservation:', writeErr?.message ?? writeErr);
      await supabase.rpc('release_stock', { p_items: reserveItems }).catch(() => {});
      await refundPayment(razorpay, payment.razorpay_payment_id, refundAmountPaise);
      return res.status(500).json({ error: 'Could not place the order. Please try again.' });
    }

    // The order exists and is paid for — everything from here is best-effort and
    // must never turn a successful checkout into an error for the buyer.
    await notifySellers(supabase, created, guestFields);

    return res.status(200).json({
      orders: created.map(({ id, order_number, boutique_id, total, created_at }) => ({
        id,
        order_number,
        boutique_id,
        total,
        created_at,
      })),
      paid: true,
      payment_method: guestFields.payment_method,
    });
  } catch (err) {
    console.error('place-order failed:', err?.message ?? err);
    return res.status(500).json({ error: 'Could not place the order. Please try again.' });
  }
}
